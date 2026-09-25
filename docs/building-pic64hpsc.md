# PIC64-HPSC QEMU Boot — Building & Running Guide

## Overview

This documents the procedure to boot a Space Grade Linux (meta-sgl) Yocto image on the PIC64-HPSC QEMU emulator. The HPSC has a multi-stage boot chain:

**SysC ZSBL → SysC RTEMS firmware → ACOT parsing → AppC release → OpenSBI → U-Boot → Linux**

## Step 1: Build Space Grade Linux

Follow the [meta-sgl building guide](https://github.com/space-grade-linux/meta-sgl/blob/main/docs/building.md) with the `pic64hpsc` machine target:

```bash
python3 -m venv venv
source venv/bin/activate
pip3 install kas

git clone https://github.com/space-grade-linux/meta-sgl
mkdir $PROJECT_DIR
KAS_WORK_DIR=$PROJECT_DIR kas build meta-sgl/kas/sgl-scarthgap-pic64hpsc.yml
```

This produces the images needed for the Application Complex (Linux side):
- `build/tmp-glibc/deploy/images/pic64hpsc/Image`
- `build/tmp-glibc/deploy/images/pic64hpsc/core-image-minimal-pic64hpsc.rootfs.cpio.gz`
- `build/tmp-glibc/deploy/images/pic64hpsc/u-boot.bin`

## Step 2: Build and Run with p64h-linux-examples

The PIC64-HPSC QEMU machine model and SDK tooling are not publicly available. Acquire access through Microchip to the following:

- `qemu` repository (HPSC fork with PIC64-HPSC machine model)
- `p64h-linux-examples` repository (v2.2.0)
- `p64h-sysc` release artifacts (v2.2.0)
- `p64h-opensbi` release artifacts (v1.8.0)

Once you have access, follow the [p64h-linux-examples building guide](https://github.com/pic64-hpsc-hx/p64h-linux-examples/blob/p64h_release/docs/building.md) to set up the workspace. Use the `--br-rootfs-local-dir` option to point at your Yocto deploy directory:

```bash
cd p64h-linux-examples
./tools/bin/build.sh -m qemu \
    --br-rootfs-local-dir /path/to/yocto/build/tmp-glibc/deploy/images/pic64hpsc \
    -r platforms/hb130x/hb1301_000_linux
```

Then launch with the [qemu.sh script](https://github.com/pic64-hpsc-hx/p64h-linux-examples/blob/p64h_release/docs/qemu.md):

```bash
./install/bin/qemu.sh -img-dir build/hb130x/hb1301_000_linux/qemu -b 1
```

## Alternative: Manual QEMU Launch

If you need more control over the QEMU invocation (e.g., custom serial routing, no terminal multiplexing), you can launch directly after building the flash images:

```bash
QEMU=/path/to/microchip-hpsc-qemu/build/qemu-system-riscv64
SDK_DIR=/path/to/p64h-linux-examples

$QEMU \
  -bios $SDK_DIR/install/zsbl/qemu/sysc_emu_loader/sysc_emu_loader.bin \
  -M microchip-hpsc-soc,mode=0,msel=1 \
  -m 2G \
  -display none \
  -semihosting-config enable=on,target=native,userspace=on \
  -serial file:/tmp/hpsc-serial0.log \
  -serial file:/tmp/hpsc-serial1.log \
  -object rng-random,filename=/dev/urandom,id=dummy0 \
  -device virtio-rng-device,rng=dummy0 \
  -device loader,file=$SDK_DIR/build/hb130x/hb1301_000_linux/qemu/sysc_flash_image_patched.bin,addr=0x200000000 \
  -device loader,file=$SDK_DIR/build/hb130x/hb1301_000_linux/qemu/appc_flash_image.bin,addr=0x247C30000000
```

**Parameters:**
- `-M microchip-hpsc-soc,mode=0,msel=1` — Unified mode (mode=0), boot profile 1 (msel=1 = unified Linux)
- `-bios` — SysC ZSBL (zero-stage boot loader), reset vector for S7 core
- `addr=0x200000000` — SysC flash memory-mapped address
- `addr=0x247C30000000` — AppC config address = SRAM_EDAC_2_1 base (0x247C00000000) + cs_offset (3 × 0x10000000)

**Serial ports:**
- serial0 = SysC UART (RTEMS console)
- serial1 = AppC UART0 (Linux console)

Monitor boot with: `tail -f /tmp/hpsc-serial1.log`

## Boot Verification

The boot sequence takes approximately **90-120 seconds** under QEMU emulation. Don't assume it's stuck until >2 minutes have elapsed.

AppC serial1 (Linux console):
```
OpenSBI origin_p64h-v1.8.0_dev
Platform Name               : microchip,p64h-dev
Platform HART Count         : 8
...
[    0.000000] Linux version 6.12.22-linux4microchip+fpga-2025.07-...
[    0.000000] Machine model: microchip,p64h-dev
...
Space Grade Linux 0.1 pic64hpsc ttyS0
pic64hpsc login:
```

::: info
The default login is `root` without a password. You can quit QEMU with `Ctrl-A x`.
:::

## Lessons Learned

### ACOT Patching is Mandatory

The pre-built SysC firmware won't release AppC without a valid ACOT (Application Complex On-chip Table) patched into its flash image. The `qemu.sh` script handles this automatically via `sysc_cfg_acot_update.py`, but if running manually you must patch the SysC flash before launching QEMU.

### PYTHONPATH for dev_cfg_pack

The ACOT update script depends on a native library (`_dev_cfg_pack.so`) that lives under `install/lib/x86_64/`. If PYTHONPATH doesn't include both `install/lib` and `install/lib/x86_64`, the import fails silently and the ACOT is never patched — resulting in SysC booting normally but never releasing AppC.

Fix when running manually:

```bash
export PYTHONPATH="$(pwd)/install/lib:$(pwd)/install/lib/x86_64:$PYTHONPATH"
```

### AppC Image Size

If your Yocto rootfs is larger than the stock Buildroot one, you may need to increase `shared_appc_cfg_size` in the platform's `p64h_sysc_appc_img.yaml`. The symptom is `dev_cfg image_builder` failing or producing a truncated flash image.

### Boot Delay Under Emulation

The ~90 second delay between SysC start and AppC release is normal under QEMU. The SysC RTEMS firmware runs self-checks and ACOT processing that are slow when emulated. The self-check warnings (arm/fire, software assert, stack overflow) are QEMU artifacts and non-fatal.

### VirtIO RNG

Adding `-object rng-random -device virtio-rng-device` prevents Linux from stalling at boot waiting for entropy. Recommended even without networking.

### No User-Mode Networking

Neither the SDK-provided QEMU nor a default source build includes SLIRP support. For SSH/network access, rebuild QEMU with `--enable-slirp` (requires `libslirp-dev`) or use a TAP interface.
