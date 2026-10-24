# PIC64-HPSC QEMU on an arm64 Host

## Overview

The [PIC64-HPSC QEMU guide](./building-pic64hpsc.md) assumes an x86_64 host. Microchip's P64H SDK
(`p64h-linux-examples` and the artifacts it downloads) ships **x86_64-only** binaries: the QEMU
machine model, the RISC-V toolchain, the `dev_cfg` flash-image builder's native library, and one
Python wheel. On an aarch64 host (for example an Ubuntu 24.04 VM on Apple Silicon) the stock
`build.sh` aborts before producing any flash image.

This page lists the extra steps that make the flow work on arm64. They were verified with:

| Component            | Version                                   |
| -------------------- | ----------------------------------------- |
| Host                 | Ubuntu 24.04, aarch64, Python 3.12        |
| meta-sgl             | `kas/sgl-scarthgap-pic64hpsc.yml`          |
| P64H SDK             | `p64h-v2.3.0` (linux-examples, sysc, opensbi, qemu) |
| Kernel in the image  | 6.12.22-linux4microchip (from the pinned `meta-mchp`) |

Only the host-side tooling is affected. The Yocto build itself is unchanged: Yocto builds its own
cross toolchain, so the x86_64 P64H toolchain is never needed for this path.

::: tip
If you have an x86_64 machine available, use it. The steps below work, but Microchip only tests
on x86_64 and each SDK release may introduce new x86-only pieces.
:::

## Step 1: Build Space Grade Linux

Exactly as in the x86 guide:

```bash
KAS_WORK_DIR=$PROJECT_DIR kas build meta-sgl/kas/sgl-scarthgap-pic64hpsc.yml
```

The deploy directory `build/tmp-glibc/deploy/images/pic64hpsc/` provides `Image`,
`core-image-minimal-pic64hpsc.rootfs.cpio.gz` and `u-boot.bin`.

## Step 2: Clone the P64H repositories

You need membership of the `pic64-hpsc-hx` GitHub organization (request it through Microchip
support). Clone these side by side, all at the same release tag:

```bash
gh repo clone pic64-hpsc-hx/p64h-linux-examples -- -b p64h_release
gh repo clone pic64-hpsc-hx/p64h-sysc -- -b p64h_public_release
gh repo clone pic64-hpsc-hx/qemu -- -b p64h_release
```

Install the host packages. The list from Microchip's Ubuntu 24 guide is a superset; the ones that
matter for the steps below are:

```bash
sudo apt install -y build-essential ninja-build meson pkg-config libglib2.0-dev libpixman-1-dev \
    libslirp-dev libcap-ng-dev libattr1-dev libfdt-dev flex bison swig python3.12-dev \
    device-tree-compiler socat minicom
```

## Step 3: Build QEMU from source

The prebuilt `qemu-system-riscv64` is an x86_64 ELF. Build the HPSC fork natively:

```bash
cd qemu
make -f makefile.hpsc clean all O=$(pwd)/build
./build/install/bin/qemu-system-riscv64 -M help | grep hpsc   # microchip-hpsc-soc
```

The `makefile.hpsc` configure line already enables slirp (user networking) and virtfs.

## Step 4: Run the SDK workspace setup once, and expect it to fail

```bash
cd p64h-linux-examples
./tools/bin/build.sh -m qemu --without-debian \
    --br-rootfs-local-dir /path/to/deploy/images/pic64hpsc \
    -r platforms/hb130x/hb1301_000_linux
```

`--without-debian` skips the ~8 GB Debian disk image, which the Yocto path does not need and
which is served from `hpsc.microchip.com` with a separate login.

This run downloads all 2.3.0 artifacts into `install/`, then exits silently while creating the
Python venv. The cause is `p64h-ftdi-jmb` in `install/venv/dev_cfg_requirements.txt`, which only
has an x86_64 wheel. `pip` is driven through `xargs`, whose non-zero exit trips `set -e` after the
last package, so nothing is printed. The package is a JTAG host tool and is not used for QEMU.

## Step 5: Replace the x86_64 pieces

All paths below are relative to `p64h-linux-examples`.

### 5a. QEMU binary

`qemu.sh` runs `install/bin/qemu-system-riscv64`. Point it at your build:

```bash
mv install/bin/qemu-system-riscv64 install/bin/qemu-system-riscv64.x86_64.orig
ln -s $(pwd)/../qemu/build/install/bin/qemu-system-riscv64 install/bin/qemu-system-riscv64
```

The symlink survives `build.sh -w`; only `build.sh -C` (clean all) re-downloads the x86 binary.

### 5b. Python requirement

```bash
sed -i.orig '/^p64h-ftdi-jmb/d' install/venv/dev_cfg_requirements.txt
rm -rf venv
```

### 5c. Native `dev_cfg_pack` module

`dev_cfg` (the flash-image builder) loads a SWIG-wrapped C library, `_dev_cfg_pack.so`, from
`install/lib/<arch>/dev_cfg_pack/`, where `<arch>` is `platform.machine()`, i.e. `aarch64` on an
arm64 host. The SDK only ships `install/lib/x86_64/`. The sources are MIT-licensed and live in
`p64h-sysc`, so build it natively. The SDK's own CMake for it pulls in code generators that need
the private firmware tree, so compile it directly:

```bash
SYSC=$(pwd)/../p64h-sysc
XXH=$(pwd)/install/share/libs/xxhash
B=$(mktemp -d)
mkdir -p $B/obj $B/out/dev_cfg_pack

# 1. SWIG wrapper
(cd $SYSC/tools/dev_cfg_pack && \
  swig -python -I$SYSC/remote/include -o $B/dev_cfg_pack_wrap.c -outdir $B/out/dev_cfg_pack dev_cfg_pack.i)

# 2. Compile (same source list as tools/dev_cfg_pack/CMakeLists.txt)
CFLAGS="-O2 -fPIC -std=gnu11 -Wno-address-of-packed-member -I$SYSC/remote/include -I$XXH $(python3.12-config --includes)"
for f in $SYSC/remote/src/dev_cfg/*.c \
         $SYSC/remote/src/board/p64h_sysc_nvm_lookup.c \
         $SYSC/remote/src/ras/p64h_sysc_ras_util.c \
         $(ls $SYSC/remote/src/generated/*.c | grep -v p64h_sysc_ras_data_print.c) \
         $XXH/xxhash.c $B/dev_cfg_pack_wrap.c; do
  gcc $CFLAGS -c $f -o $B/obj/$(basename $f .c).o
done

# 3. Link and install
gcc -shared -o $B/out/dev_cfg_pack/_dev_cfg_pack.so $B/obj/*.o
mkdir -p install/lib/aarch64/dev_cfg_pack
cp $B/out/dev_cfg_pack/dev_cfg_pack.py $B/out/dev_cfg_pack/_dev_cfg_pack.so install/lib/aarch64/dev_cfg_pack/
cp install/lib/x86_64/dev_cfg_pack/setup.py install/lib/aarch64/dev_cfg_pack/

# 4. Sanity check
(cd install/lib/aarch64 && python3.12 -c "import dev_cfg_pack.dev_cfg_pack as d; print(d.P64H_SYSC_APPC_CFG_PARTITION_MAX)")   # prints 8
```

Skip `dev_cfg_pack_image_builder.internal.c` if you happen to have it; the public
`dev_cfg_pack_image_builder.c` is the right one. The x86 `.so` links only against libc and bundles
xxhash, and so does this build.

The other native modules under `install/lib/x86_64/` (`psac_py`, `sec_jtag_api_py`,
`sysc_api_py`) are for programming or talking to real hardware. `dev_cfg` logs a warning when
they are missing and carries on.

### 5d. U-Boot host tools

Boot profile 4 of `hb1301_000_linux` is a U-Boot profile and the image builder calls `mkenvimage`
for it. It looks on `$PATH` first, then in `install/bin/`. Either `sudo apt install u-boot-tools`,
or without root:

```bash
(cd $(mktemp -d) && apt-get download u-boot-tools && dpkg -x u-boot-tools_*.deb ex && \
  cp ex/usr/bin/{mkenvimage,mkimage,dumpimage} $OLDPWD/install/bin/)
```

### 5e. Root filesystem layout

This one is not arm64-specific; it also bites on x86 with SDK 2.3.0. `--br-rootfs-local-dir`
symlinks each *subdirectory* of the given path into `install/appc/linux/buildroot/rootfs/`, and
the `hb1301_000_linux` platform expects a Buildroot layout:

```
rootfs/p64h/images/Image
rootfs/p64h/images/rootfs.cpio.gz
```

Pointing it straight at the Yocto deploy directory (which has no subdirectories) links nothing.
Make a shim directory instead:

```bash
DEPLOY=/path/to/build/tmp-glibc/deploy/images/pic64hpsc
SHIM=/path/to/hpsc-rootfs-shim
mkdir -p $SHIM/p64h/images
ln -sfn $DEPLOY/Image $SHIM/p64h/images/Image
ln -sfn $DEPLOY/core-image-minimal-pic64hpsc.rootfs.cpio.gz $SHIM/p64h/images/rootfs.cpio.gz
```

The same platform file lists `install/appc/linux/uboot/c0/u-boot.bin` as a shared binary. It is
normally delivered by the `p64h_linux_examples` artifact, which `build.sh` does not download when
run from inside the repository without `--quickstart`. The Yocto build produces the same U-Boot
fork (`u-boot-mchp` 2024.07+p64h), so link it:

```bash
mkdir -p install/appc/linux/uboot/c0
ln -sfn $DEPLOY/u-boot.bin install/appc/linux/uboot/c0/u-boot.bin
```

## Step 6: Build the flash image and boot

```bash
./tools/bin/build.sh -m qemu --without-debian -w \
    --br-rootfs-local-dir $SHIM \
    -r platforms/hb130x/hb1301_000_linux
```

`-w` refreshes the workspace so the shim gets linked. A successful run ends with
`... finishing building AppC Config projects` and leaves `appc_flash_image.bin`, `acot_cfg.bin`,
`acot_ptr.bin` and `appc_img_report.txt` in `build/hb130x/hb1301_000_linux/qemu/`. Check the
report: `shared_kernel` and `shared_rootfs` sizes should match your `Image` and `.cpio.gz`.

Boot profile 1 (unified Linux) in one terminal and attach to the Linux console in a second:

```bash
./install/bin/qemu.sh -img-dir build/hb130x/hb1301_000_linux/qemu -b 1
```

```bash
./install/bin/qemu.sh -term0
```

QEMU creates `serial1.sock` with `wait=on`, so it does not start executing until something
connects to the Linux console; the first terminal appears to hang until you run `-term0`. The
SysC console is on QEMU's stdio in the first terminal. Boot to the login prompt takes about two
minutes. The default login is `root` with no password.

## Expected console output

```
OpenSBI origin_p64h-v2.3.0_dev
Platform Name               : microchip,p64h-dev
Platform HART Count         : 8
...
[    0.000000] Linux version 6.12.22-linux4microchip+fpga-2025.07-...
[    0.000000] Machine model: microchip,p64h-dev
[    0.164058] smp: Brought up 1 node, 8 CPUs
...
Space Grade Linux 0.1 pic64hpsc ttyS0

pic64hpsc login:
```

The following messages are expected under QEMU and are non-fatal:

- OpenSBI: `timer@4000c200000 (microchip,p64h-timer-clocksource) init failed: -1006` and
  `p64h_final_init: failed to initialized microchip p64h drivers`. OpenSBI falls back to the
  ACLINT timer.
- Kernel: a run of `software IO TLB: swiotlb_memblock_alloc: Failed to allocate ...` lines and
  one `page allocation failure: order:5 ... GFP_DMA32` backtrace during early init, from the
  2 GB RAM layout.
- Kernel: `cadence-nand-controller ... probe ... failed with error -11`. NAND is not modelled
  unless `qemu.sh --nand` is used.
- QEMU: `warning: nic cadence_gem.N has no peer`. The GEM Ethernet ports have no backend; use the
  virtio network path if you need connectivity.

## Known limitations

- The 2.3.0 SDK renamed the Yocto image to `core-image-base` and added a
  `hb1301_000_profile_0_yocto` platform that reads a Yocto deploy tree directly via
  `--yocto-local-dir`. The meta-sgl kas config still pins the older `meta-mchp` revision that
  builds `core-image-minimal` with kernel 6.12, which is why this page uses the Buildroot-layout
  shim and the `hb1301_000_linux` platform. Bumping the `meta-mchp` pin would let the native
  Yocto platform be used instead.
- Nothing here has been tried with the RTEMS, VxWorks or bare-metal example repositories. They
  need the x86_64 P64H toolchain to compile anything.
