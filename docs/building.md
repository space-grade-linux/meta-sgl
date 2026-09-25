# Building meta-sgl with kas

Here are simple instructions for getting started building Space Grade Linux with
[kas](https://kas.readthedocs.io/en/latest/), the build tool used to drive the
Yocto/OpenEmbedded builds in this repository.

## Installing kas

To create a Python virtual environment to install kas run these commands:

```bash
python3 -m venv venv
source venv/bin/activate
pip3 install kas
```

## Clone the meta-sgl build branch
After you have sourced the environment where kas is installed you may get the
kas configuration by cloning meta-sgl:

```bash
git clone https://github.com/space-grade-linux/meta-sgl
```

## Choosing a configuration

The build is selected by a top-level kas configuration file under `kas/`. The
file names follow the pattern:

```
sgl-<yocto-release>[-spaceros-<distro>][-core]-<machine>.yml
```

The pieces that compose a configuration live in sub-directories and are pulled
in via `includes`:

- **Yocto release** (`kas/yocto/`) — `scarthgap` (the current Yocto LTS and the
  default for SGL), `wrynose` (the newer Yocto LTS), and `master`
  (development/rolling).
- **Machine** (`kas/machine/`) — supported QEMU targets are `qemuriscv64`,
  `qemuarm64`, and `qemux86-64`; hardware targets include `beaglev-fire` and
  others.
- **Space ROS** (`kas/spaceros/`) — optional layers adding Space ROS on Jazzy.
  Releases `jazzy-2025.10` and `jazzy-2026.04` are available.

Some examples of ready-made top-level configurations:

| Configuration | Description |
| --- | --- |
| `kas/sgl-scarthgap-qemuriscv64.yml` | Base SGL image, scarthgap, RISC-V QEMU |
| `kas/sgl-scarthgap-qemux86-64.yml` | Base SGL image, scarthgap, x86-64 QEMU |
| `kas/sgl-scarthgap-qemuarm64.yml` | Base SGL image, scarthgap, ARM64 QEMU |
| `kas/sgl-scarthgap-beaglev-fire.yml` | Base SGL image for the BeagleV-Fire board |
| `kas/sgl-scarthgap-spaceros-jazzy-2026.04-qemux86-64.yml` | Space ROS (full `world`), x86-64 QEMU |
| `kas/sgl-scarthgap-spaceros-jazzy-2026.04-core-qemux86-64.yml` | Space ROS (`core` package group), x86-64 QEMU |

The base SGL configurations build `core-image-minimal`. The Space ROS
configurations extend that image with the Space ROS package groups — the
`-core` variants install `packagegroup-spaceros-jazzy-core` (a smaller set),
while the non-`core` variants install `packagegroup-spaceros-jazzy-world` (the
full set).

## Running kas
Create a new project directory wherever you want and set the KAS_WORK_DIR 
environment variable to point to it.  Then run kas with the configuration file
of your choice. For example, to build the base SGL image for Yocto scarthgap on
qemuriscv64:

```bash
mkdir $PROJECT_DIR
KAS_WORK_DIR=$PROJECT_DIR
kas build meta-sgl/kas/sgl-scarthgap-qemuriscv64.yml
```

This should complete successfully and produce an image you can run in QEMU.

```bash
build/tmp-glibc/deploy/images/qemuriscv64/core-image-minimal-qemuriscv64.rootfs.ext4
```

To build a Space ROS image instead, point kas at one of the Space ROS
configurations, e.g.:

```bash
kas build meta-sgl/kas/sgl-scarthgap-spaceros-jazzy-2026.04-core-qemux86-64.yml
```

## Running QEMU

You can run the images in QEMU by executing them with the proper runtime. The
example below is for the `qemuriscv64` image. For the `qemuarm64` and
`qemux86-64` machines you can also let Yocto assemble the command for you by
running `runqemu <machine>` from inside the build environment, e.g.
`kas shell meta-sgl/kas/sgl-scarthgap-qemux86-64.yml -c "runqemu qemux86-64 nographic"`.

Here's an example command for `qemuriscv64`:

```bash
cd $KAS_WORK_DIR
qemu-system-riscv64 \
  -M virt -m 512M -nographic \
  -kernel build/tmp-glibc/deploy/images/qemuriscv64/Image \
  -append "root=/dev/vda rw console=ttyS0" \
  -drive file=build/tmp-glibc/deploy/images/qemuriscv64/core-image-minimal-qemuriscv64.rootfs.ext4,format=raw,id=hd0,if=none \
  -device virtio-blk-device,drive=hd0 \
  -netdev user,id=net0 \
  -device virtio-net-device,netdev=net0
```

It would produce output similar to:

```
OpenSBI v0.9
   ____                    _____ ____ _____
  / __ \                  / ____|  _ \_   _|
 | |  | |_ __   ___ _ __ | (___ | |_) || |
 | |  | | '_ \ / _ \ '_ \ \___ \|  _ < | |
 | |__| | |_) |  __/ | | |____) | |_) || |_
  \____/| .__/ \___|_| |_|_____/|____/_____|
        | |
        |_|

Platform Name             : riscv-virtio,qemu
Platform Features         : timer,mfdeleg
Platform HART Count       : 1
Firmware Base             : 0x80000000
Firmware Size             : 100 KB
Runtime SBI Version       : 0.2

Domain0 Name              : root
Domain0 Boot HART         : 0
Domain0 HARTs             : 0*
Domain0 Region00          : 0x0000000080000000-0x000000008001ffff ()
Domain0 Region01          : 0x0000000000000000-0xffffffffffffffff (R,W,X)
Domain0 Next Address      : 0x0000000080200000
Domain0 Next Arg1         : 0x000000009f000000
Domain0 Next Mode         : S-mode
Domain0 SysReset          : yes

Boot HART ID              : 0
Boot HART Domain          : root
Boot HART ISA             : rv64imafdcsu
Boot HART Features        : scounteren,mcounteren,time
Boot HART PMP Count       : 16
Boot HART PMP Granularity : 4
Boot HART PMP Address Bits: 54
Boot HART MHPM Count      : 0
Boot HART MHPM Count      : 0
Boot HART MIDELEG         : 0x0000000000000222
Boot HART MEDELEG         : 0x000000000000b109
[    0.000000] Linux version 6.6.84-yocto-standard (oe-user@oe-host) (riscv64-sgl-linux-gcc (GCC) 13.3.0, GNU ld (GNU Binutils) 2.42.0.20240723) #1 SMP PREEMPT Tue Mar 25 18:25:39 UTC 2025
[    0.000000] Machine model: riscv-virtio,qemu
[    0.000000] SBI specification v0.2 detected
[    0.000000] SBI implementation ID=0x1 Version=0x9
[    0.000000] SBI TIME extension detected
[    0.000000] SBI IPI extension detected
[    0.000000] SBI RFENCE extension detected
[    0.000000] efi: UEFI not found.
[    0.000000] OF: reserved mem: 0x0000000080000000..0x000000008001ffff (128 KiB) map non-reusable mmode_resv0@80000000
[    0.000000] Zone ranges:
[    0.000000]   DMA32    [mem 0x0000000080000000-0x000000009fffffff]
[    0.000000]   Normal   empty
[    0.000000] Movable zone start for each node
[    0.000000] Early memory node ranges
[    0.000000]   node   0: [mem 0x0000000080000000-0x000000009fffffff]
[    0.000000] Initmem setup node 0 [mem 0x0000000080000000-0x000000009fffffff]
[    0.000000] SBI HSM extension detected
[    0.000000] Falling back to deprecated "riscv,isa"
[    0.000000] riscv: base ISA extensions acdfim
[    0.000000] riscv: ELF capabilities acdfim
[    0.000000] percpu: Embedded 27 pages/cpu s72232 r8192 d30168 u110592
[    0.000000] Kernel command line: root=/dev/vda rw console=ttyS0
[    0.000000] Dentry cache hash table entries: 65536 (order: 7, 524288 bytes, linear)
[    0.000000] Inode-cache hash table entries: 32768 (order: 6, 262144 bytes, linear)
[    0.000000] Built 1 zonelists, mobility grouping on.  Total pages: 129024
[    0.000000] mem auto-init: stack:all(zero), heap alloc:off, heap free:off
[    0.000000] Memory: 486064K/524288K available (10258K kernel code, 5810K rwdata, 4096K rodata, 2252K init, 506K bss, 38224K reserved, 0K cma-reserved)
[    0.000000] SLUB: HWalign=64, Order=0-3, MinObjects=0, CPUs=1, Nodes=1
[    0.000000] rcu: Preemptible hierarchical RCU implementation.
[    0.000000] rcu: 	RCU event tracing is enabled.
[    0.000000] rcu: 	RCU restricting CPUs from NR_CPUS=8 to nr_cpu_ids=1.
[    0.000000] 	Trampoline variant of Tasks RCU enabled.
[    0.000000] 	Tracing variant of Tasks RCU enabled.
[    0.000000] rcu: RCU calculated value of scheduler-enlistment delay is 25 jiffies.
[    0.000000] rcu: Adjusting geometry for rcu_fanout_leaf=16, nr_cpu_ids=1
[    0.000000] NR_IRQS: 64, nr_irqs: 64, preallocated irqs: 0
[    0.000000] riscv-intc: 64 local interrupts mapped
[    0.000000] plic: plic@c000000: mapped 53 interrupts with 1 handlers for 2 contexts.
[    0.000000] riscv: providing IPIs using SBI IPI extension
[    0.000000] rcu: srcu_init: Setting srcu_struct sizes based on contention.
[    0.000000] clocksource: riscv_clocksource: mask: 0xffffffffffffffff max_cycles: 0x24e6a1710, max_idle_ns: 440795202120 ns
[    0.000039] sched_clock: 64 bits at 10MHz, resolution 100ns, wraps every 4398046511100ns
[    0.003104] kfence: initialized - using 2097152 bytes for 255 objects at 0x(____ptrval____)-0x(____ptrval____)
[    0.006225] Console: colour dummy device 80x25
[    0.006872] Calibrating delay loop (skipped), value calculated using timer frequency.. 20.00 BogoMIPS (lpj=40000)
[    0.006952] pid_max: default: 32768 minimum: 301
[    0.007555] LSM: initializing lsm=capability,landlock,integrity
[    0.007779] landlock: Up and running.
[    0.008901] Mount-cache hash table entries: 1024 (order: 1, 8192 bytes, linear)
[    0.008926] Mountpoint-cache hash table entries: 1024 (order: 1, 8192 bytes, linear)
[    0.030087] RCU Tasks: Setting shift to 0 and lim to 1 rcu_task_cb_adjust=1 rcu_task_cpu_ids=1.
[    0.030426] RCU Tasks Trace: Setting shift to 0 and lim to 1 rcu_task_cb_adjust=1 rcu_task_cpu_ids=1.
[    0.030611] riscv: ELF compat mode unsupported
[    0.030716] ASID allocator using 16 bits (65536 entries)
[    0.031142] rcu: Hierarchical SRCU implementation.
[    0.031159] rcu: 	Max phase no-delay instances is 1000.
[    0.034133] EFI services will not be available.
[    0.034441] smp: Bringing up secondary CPUs ...
[    0.034754] smp: Brought up 1 node, 1 CPU
[    0.040893] devtmpfs: initialized
[    0.046760] clocksource: jiffies: mask: 0xffffffff max_cycles: 0xffffffff, max_idle_ns: 7645041785100000 ns
[    0.046849] futex hash table entries: 256 (order: 2, 16384 bytes, linear)
[    0.050300] NET: Registered PF_NETLINK/PF_ROUTE protocol family
[    0.053050] DMA: preallocated 128 KiB GFP_KERNEL pool for atomic allocations
[    0.053205] DMA: preallocated 128 KiB GFP_KERNEL|GFP_DMA32 pool for atomic allocations
[    0.081663] cpu0: Ratio of byte access time to unaligned word access is 7.33, unaligned accesses are fast
[    0.239530] raid6: int64x8  gen()  1020 MB/s
[    0.382976] raid6: int64x4  gen()  3624 MB/s
[    0.470662] raid6: int64x2  gen()  4389 MB/s
[    0.539804] raid6: int64x1  gen()  3334 MB/s
[    0.539852] raid6: using algorithm int64x2 gen() 4389 MB/s
[    0.609786] raid6: .... xor() 2400 MB/s, rmw enabled
[    0.609846] raid6: using intx1 recovery algorithm
[    0.611231] SCSI subsystem initialized
[    0.611431] usbcore: registered new interface driver usbfs
[    0.611544] usbcore: registered new interface driver hub
[    0.611613] usbcore: registered new device driver usb
[    0.611780] pps_core: LinuxPPS API ver. 1 registered
[    0.611787] pps_core: Software ver. 5.3.6 - Copyright 2005-2007 Rodolfo Giometti <giometti@linux.it>
[    0.611814] PTP clock support registered
[    0.619306] vgaarb: loaded
[    0.619975] clocksource: Switched to clocksource riscv_clocksource
[    0.630444] NET: Registered PF_INET protocol family
[    0.630981] IP idents hash table entries: 8192 (order: 4, 65536 bytes, linear)
[    0.633892] tcp_listen_portaddr_hash hash table entries: 256 (order: 0, 4096 bytes, linear)
[    0.633950] Table-perturb hash table entries: 65536 (order: 6, 262144 bytes, linear)
[    0.633976] TCP established hash table entries: 4096 (order: 3, 32768 bytes, linear)
[    0.634136] TCP bind hash table entries: 4096 (order: 5, 131072 bytes, linear)
[    0.638474] TCP: Hash tables configured (established 4096 bind 4096)
[    0.639347] UDP hash table entries: 256 (order: 1, 8192 bytes, linear)
[    0.639461] UDP-Lite hash table entries: 256 (order: 1, 8192 bytes, linear)
[    0.640253] NET: Registered PF_UNIX/PF_LOCAL protocol family
[    0.641561] RPC: Registered named UNIX socket transport module.
[    0.641583] RPC: Registered udp transport module.
[    0.641587] RPC: Registered tcp transport module.
[    0.641592] RPC: Registered tcp-with-tls transport module.
[    0.641595] RPC: Registered tcp NFSv4.1 backchannel transport module.
[    0.641658] PCI: CLS 0 bytes, default 64
[    0.646079] workingset: timestamp_bits=46 max_order=17 bucket_order=0
[    0.648202] NFS: Registering the id_resolver key type
[    0.650748] Key type id_resolver registered
[    0.650776] Key type id_legacy registered
[    0.652295] Key type cifs.idmap registered
[    0.724960] xor: measuring software checksum speed
[    0.725639]    8regs           :  5312 MB/sec
[    0.726445]    8regs_prefetch  :  5078 MB/sec
[    0.727126]    32regs          :  4907 MB/sec
[    0.727683]    32regs_prefetch :  6001 MB/sec
[    0.727701] xor: using function: 32regs_prefetch (6001 MB/sec)
[    0.728023] Block layer SCSI generic (bsg) driver version 0.4 loaded (major 251)
[    0.728183] io scheduler mq-deadline registered
[    0.728223] io scheduler kyber registered
[    0.730425] pci-host-generic 30000000.pci: host bridge /soc/pci@30000000 ranges:
[    0.730787] pci-host-generic 30000000.pci:       IO 0x0003000000..0x000300ffff -> 0x0000000000
[    0.731021] pci-host-generic 30000000.pci:      MEM 0x0040000000..0x007fffffff -> 0x0040000000
[    0.731057] pci-host-generic 30000000.pci:      MEM 0x0400000000..0x07ffffffff -> 0x0400000000
[    0.731362] pci-host-generic 30000000.pci: Memory resource size exceeds max for 32 bits
[    0.731578] pci-host-generic 30000000.pci: ECAM at [mem 0x30000000-0x3fffffff] for [bus 00-ff]
[    0.732427] pci-host-generic 30000000.pci: PCI host bridge to bus 0000:00
[    0.732514] pci_bus 0000:00: root bus resource [bus 00-ff]
[    0.732546] pci_bus 0000:00: root bus resource [io  0x0000-0xffff]
[    0.732564] pci_bus 0000:00: root bus resource [mem 0x40000000-0x7fffffff]
[    0.732569] pci_bus 0000:00: root bus resource [mem 0x400000000-0x7ffffffff]
[    0.733105] pci 0000:00:00.0: [1b36:0008] type 00 class 0x060000
[    0.738681] Serial: 8250/16550 driver, 4 ports, IRQ sharing disabled
[    0.744404] printk: console [ttyS0] disabled
[    0.748714] 10000000.uart: ttyS0 at MMIO 0x10000000 (irq = 12, base_baud = 230400) is a 16550A
[    0.749389] printk: console [ttyS0] enabled
[    0.778471] brd: module loaded
[    0.778938] virtio_blk virtio0: 1/0/0 default/read/poll queues
[    0.782601] virtio_blk virtio0: [vda] 232074 512-byte logical blocks (119 MB/113 MiB)
[    0.799195] goldfish_rtc 101000.rtc: registered as rtc0
[    0.799548] goldfish_rtc 101000.rtc: setting system clock to 2025-08-21T14:02:30 UTC (1755784950)
[    0.801018] device-mapper: ioctl: 4.48.0-ioctl (2023-03-01) initialised: dm-devel@redhat.com
[    0.802266] usbcore: registered new interface driver usbhid
[    0.802364] usbhid: USB HID core driver
[    0.802661] u32 classifier
[    0.802733]     input device check on
[    0.802869]     Actions configured
[    0.803580] NET: Registered PF_INET6 protocol family
[    0.807259] Segment Routing with IPv6
[    0.807481] In-situ OAM (IOAM) with IPv6
[    0.807840] sit: IPv6, IPv4 and MPLS over IPv4 tunneling driver
[    0.809474] NET: Registered PF_PACKET protocol family
[    0.809835] Bridge firewalling registered
[    0.810416] Key type dns_resolver registered
[    0.810801] NET: Registered PF_VSOCK protocol family
[    0.817156] registered taskstats version 1
[    0.823744] Key type .fscrypt registered
[    0.823880] Key type fscrypt-provisioning registered
[    0.830783] Btrfs loaded, zoned=no, fsverity=no
[    0.842093] Key type encrypted registered
[    0.843182] printk: console [netcon0] enabled
[    0.843290] netconsole: network logging started
[    0.843826] Legacy PMU implementation is available
[    0.845502] clk: Disabling unused clocks
[    0.848478] md: Waiting for all devices to be available before autodetect
[    0.848739] md: If you don't use raid, use raid=noautodetect
[    0.848864] md: Autodetecting RAID arrays.
[    0.848982] md: autorun ...
[    0.849055] md: ... autorun DONE.
[    0.891229] EXT4-fs (vda): recovery complete
[    0.892275] EXT4-fs (vda): mounted filesystem 893064d7-993d-4b9c-9268-6449104d5b31 r/w with ordered data mode. Quota mode: disabled.
[    0.892732] VFS: Mounted root (ext4 filesystem) on device 253:0.
[    0.894486] devtmpfs: mounted
[    0.915727] Freeing unused kernel image (initmem) memory: 2252K
[    0.916572] Run /sbin/init as init process
[    1.149544] systemd[1]: systemd 255.17^ running in system mode (-PAM -AUDIT -SELINUX -APPARMOR +IMA -SMACK -SECCOMP -GCRYPT -GNUTLS -OPENSSL -ACL +BLKID -CURL -ELFUTILS -FIDO2 -IDN2 -IDN -IPTC +KMOD -LIBCRYPTSETUP +LIBFDISK -PCRE2 -PWQUALITY -P11KIT -QRENCODE -TPM2 -BZIP2 -LZ4 -XZ -ZLIB +ZSTD -BPF_FRAMEWORK -XKBCOMMON +UTMP +SYSVINIT default-hierarchy=unified)
[    1.150387] systemd[1]: Detected virtualization qemu.
[    1.150651] systemd[1]: Detected architecture riscv64.

Welcome to Space Grade Linux 0.1 (wone)!

[    1.159308] systemd[1]: Hostname set to <qemuriscv64>.
[    2.225061] systemd[1]: Queued start job for default target Multi-User System.
[    2.291350] systemd[1]: Created slice Slice /system/getty.
[  OK  ] Created slice Slice /system/getty.
[    2.298320] systemd[1]: Created slice Slice /system/modprobe.
[  OK  ] Created slice Slice /system/modprobe.
[    2.303375] systemd[1]: Created slice Slice /system/serial-getty.
[  OK  ] Created slice Slice /system/serial-getty.
[    2.307994] systemd[1]: Created slice User and Session Slice.
[  OK  ] Created slice User and Session Slice.
[    2.310505] systemd[1]: Started Dispatch Password Requests to Console Directory Watch.
[  OK  ] Started Dispatch Password Requests to Console Directory Watch.
[    2.312376] systemd[1]: Started Forward Password Requests to Wall Directory Watch.
[  OK  ] Started Forward Password Requests to Wall Directory Watch.
[    2.313336] systemd[1]: Reached target Path Units.
[  OK  ] Reached target Path Units.
[    2.314265] systemd[1]: Reached target Remote File Systems.
[  OK  ] Reached target Remote File Systems.
[    2.315059] systemd[1]: Reached target Slice Units.
[  OK  ] Reached target Slice Units.
[    2.315734] systemd[1]: Reached target Swaps.
[  OK  ] Reached target Swaps.
[    2.321836] systemd[1]: Listening on Syslog Socket.
[  OK  ] Listening on Syslog Socket.
[    2.324211] systemd[1]: Listening on initctl Compatibility Named Pipe.
[  OK  ] Listening on initctl Compatibility Named Pipe.
[    2.358830] systemd[1]: Journal Audit Socket was skipped because of an unmet condition check (ConditionSecurity=audit).
[    2.362114] systemd[1]: Listening on Journal Socket (/dev/log).
[  OK  ] Listening on Journal Socket (/dev/log).
[    2.365735] systemd[1]: Listening on Journal Socket.
[  OK  ] Listening on Journal Socket.
[    2.369199] systemd[1]: Listening on Network Service Netlink Socket.
[  OK  ] Listening on Network Service Netlink Socket.
[    2.373403] systemd[1]: Listening on udev Control Socket.
[  OK  ] Listening on udev Control Socket.
[    2.375615] systemd[1]: Listening on udev Kernel Socket.
[  OK  ] Listening on udev Kernel Socket.
[    2.378657] systemd[1]: Listening on User Database Manager Socket.
[  OK  ] Listening on User Database Manager Socket.
[    2.381526] systemd[1]: Huge Pages File System was skipped because of an unmet condition check (ConditionPathExists=/sys/kernel/mm/hugepages).
[    2.409407] systemd[1]: Mounting POSIX Message Queue File System...
         Mounting POSIX Message Queue File System...
[    2.444791] systemd[1]: Mounting Kernel Debug File System...
         Mounting Kernel Debug File System...
[    2.508667] systemd[1]: Mounting Kernel Trace File System...
         Mounting Kernel Trace File System...
[    2.568723] systemd[1]: Mounting Temporary Directory /tmp...
         Mounting Temporary Directory /tmp...
[    2.570318] systemd[1]: Create List of Static Device Nodes was skipped because of an unmet condition check (ConditionFileNotEmpty=/lib/modules/6.6.84-yocto-standard/modules.devname).
[    2.643450] systemd[1]: Starting Load Kernel Module configfs...
         Starting Load Kernel Module configfs...
[    2.761990] systemd[1]: Starting Load Kernel Module drm...
         Starting Load Kernel Module drm...
[    2.862071] systemd[1]: Starting Load Kernel Module fuse...
         Starting Load Kernel Module fuse...
[    2.863560] systemd[1]: File System Check on Root Device was skipped because of an unmet condition check (ConditionPathIsReadWrite=!/).
[    3.033516] systemd[1]: Starting Journal Service...
         Starting Journal Service...
[    3.049096] systemd[1]: Load Kernel Modules was skipped because no trigger condition checks were met.
[    3.145969] systemd[1]: Starting Generate network units from Kernel command line...
         Starting Generate network units from Kernel command line...
[    3.253660] systemd[1]: Starting Remount Root and Kernel File Systems...
         Starting Remount Root and Kernel File Systems...
[    3.337344] systemd[1]: Starting Apply Kernel Variables...
         Starting Apply Kernel Variables...
[    3.401420] systemd[1]: Starting Create Static Device Nodes in /dev gracefully...
         Starting Create Static Device Nodes in /dev gracefully...
[    3.486461] systemd[1]: Starting Coldplug All udev Devices...
         Starting Coldplug All udev Devices...
[    3.690204] systemd[1]: Mounted POSIX Message Queue File System.
[  OK  ] Mounted POSIX Message Queue File System.
[    3.712153] systemd[1]: Mounted Kernel Debug File System.
[  OK  ] Mounted Kernel Debug File System.
[    3.714315] systemd[1]: Mounted Kernel Trace File System.
[  OK  ] Mounted Kernel Trace File System.
[    3.720084] systemd-journald[74]: Collecting audit messages is disabled.
[    3.734402] systemd[1]: Mounted Temporary Directory /tmp.
[  OK  ] Mounted Temporary Directory /tmp.
[    3.772162] systemd[1]: modprobe@configfs.service: Deactivated successfully.
[    3.814383] systemd[1]: Finished Load Kernel Module configfs.
[  OK  ] Finished Load Kernel Module configfs.
[    3.903508] systemd[1]: modprobe@drm.service: Deactivated successfully.
[    3.954863] systemd[1]: Finished Load Kernel Module drm.
[  OK  ] Finished Load Kernel Module drm.
[    4.008438] systemd[1]: modprobe@fuse.service: Deactivated successfully.
[    4.065148] systemd[1]: Finished Load Kernel Module fuse.
[  OK  ] Finished Load Kernel Module fuse.
[    4.110287] systemd[1]: Finished Generate network units from Kernel command line.
[  OK  ] Finished Generate network units from Kernel command line.
[    4.140153] EXT4-fs (vda): re-mounted 893064d7-993d-4b9c-9268-6449104d5b31 r/w. Quota mode: disabled.
[    4.225136] systemd[1]: Finished Remount Root and Kernel File Systems.
[  OK  ] Finished Remount Root and Kernel File Systems.
[    4.231858] systemd[1]: Reached target Preparation for Network.
[  OK  ] Reached target Preparation for Network.
[    4.250430] systemd[1]: FUSE Control File System was skipped because of an unmet condition check (ConditionPathExists=/sys/fs/fuse/connections).
[    4.251253] systemd[1]: Kernel Configuration File System was skipped because of an unmet condition check (ConditionPathExists=/sys/kernel/config).
[    4.285781] systemd[1]: Rebuild Hardware Database was skipped because of an unmet condition check (ConditionNeedsUpdate=/etc).
[    4.453361] systemd[1]: Finished Apply Kernel Variables.
[  OK  ] Finished Apply Kernel Variables.
[    4.466625] systemd[1]: Started Journal Service.
[  OK  ] Started Journal Service.
         Starting Flush Journal to Persistent Storage...
[  OK  ] Finished Create Static Device Nodes in /dev gracefully.
         Starting Create Static Device Nodes in /dev...
[    4.898100] systemd-journald[74]: Received client request to flush runtime journal.
[  OK  ] Finished Flush Journal to Persistent Storage.
[  OK  ] Finished Create Static Device Nodes in /dev.
[  OK  ] Reached target Preparation for Local File Systems.
         Mounting /var/volatile...
         Starting Rule-based Manager for Device Events and Files...
[  OK  ] Mounted /var/volatile.
         Starting Load/Save OS Random Seed...
[  OK  ] Reached target Local File Systems.
         Starting Create System Files and Directories...
[  OK  ] Started Rule-based Manager for Device Events and Files.
         Starting Network Configuration...
         Starting User Database Manager...
[  OK  ] Finished Create System Files and Directories.
         Starting Network Name Resolution...
         Starting Network Time Synchronization...
         Starting Record System Boot/Shutdown in UTMP...
[  OK  ] Finished Coldplug All udev Devices.
[  OK  ] Started User Database Manager.
[  OK  ] Finished Record System Boot/Shutdown in UTMP.
         Starting Virtual Console Setup...
[   10.588402] random: crng init done
[  OK  ] Finished Load/Save OS Random Seed.
[  OK  ] Started Network Time Synchronization.
[  OK  ] Reached target System Time Set.
[  OK  ] Started Network Name Resolution.
[  OK  ] Reached target Host and Network Name Lookups.
[  OK  ] Started Network Configuration.
[  OK  ] Reached target Network.
[  OK  ] Finished Virtual Console Setup.
[  OK  ] Reached target System Initialization.
[  OK  ] Started Daily Cleanup of Temporary Directories.
[  OK  ] Reached target Timer Units.
[  OK  ] Listening on D-Bus System Message Bus Socket.
[  OK  ] Reached target Socket Units.
[  OK  ] Reached target Basic System.
[  OK  ] Started Kernel Logging Service.
[  OK  ] Started System Logging Service.
         Starting D-Bus System Message Bus...
[  OK  ] Started Getty on tty1.
[  OK  ] Started Serial Getty on ttyS0.
[  OK  ] Reached target Login Prompts.
         Starting User Login Management...
[  OK  ] Started D-Bus System Message Bus.
[  OK  ] Started User Login Management.
[  OK  ] Reached target Multi-User System.
         Starting Record Runlevel Change in UTMP...
[  OK  ] Finished Record Runlevel Change in UTMP.

Space Grade Linux 0.1 qemuriscv64 ttyS0

qemuriscv64 login: 
```

> [!NOTE]
> The default login is `root` without a password. You can quit QEMU with `Ctrl A - x`.

