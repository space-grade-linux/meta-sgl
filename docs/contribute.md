# How to contribute

To contribute, please send GitHub pull requests to the meta-sgl repository.
Make sure your commits include a Signed-off-by line to comply with the [Developer Certificate of Origin (DCO)](https://developercertificate.org/).

To sign off your commits, use the `-s` flag:

```bash
git commit -sv
```

## CI workflows

All build workflows use a shared reusable workflow (`.github/workflows/build-sgl.yml`) that handles caching, host setup, and the kas build. Each target has a thin caller workflow that passes the kas config, hardware architecture, and build profile.

Runners are configured in `.github/runs-on.yml` using [RunsOn](https://runs-on.com) named profiles. All runners use on-demand EC2 instances with local NVMe storage.

### Adding a new build target

1. Create a kas configuration file in `kas/`:

```yaml
header:
  version: 14
  includes:
    - kas/sgl-scarthgap-qemuarm64.yml
    - kas/spaceros/jazzy-2025.10.yml
```

2. Create a workflow caller in `.github/workflows/`:

```yaml
name: QEMU ARM64 + SpaceROS

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

jobs:
  build:
    uses: ./.github/workflows/build-sgl.yml
    with:
      kas_config: sgl-scarthgap-spaceros-jazzy-2025.10-qemuarm64.yml
      hardware_arch: qemuarm64
      build_profile: spaceros
```

Available inputs for `build-sgl.yml`:

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `kas_config` | yes | — | KAS config file relative to `kas/` |
| `hardware_arch` | yes | — | Architecture identifier, used for cache keys |
| `runner_arch` | no | `arm64` | Runner architecture: `arm64` or `x64` |
| `runner_size` | no | `default` | Runner size: `default` (32-cpu) or `xlarge` (64-cpu) |
| `build_profile` | no | `sgl` | Cache isolation key (e.g. `sgl`, `spaceros`) |

Set `runner_arch: x64` for native x86-64 builds. Set `build_profile: spaceros` for SpaceROS targets to isolate their sstate cache from base SGL builds.

### Debugging a failing workflow

Check the runner details in the "Set up job" step — it shows the instance type, CPU count, disk space, and whether the instance is on-demand or spot.

Common failure modes:

- **"No space left on device"** — The runner ran out of disk. Ensure the runner config in `.github/runs-on.yml` uses instance families with local NVMe (the `d` suffix, e.g. `c7gd`, `c6id`).
- **"The runner has received a shutdown signal"** — The EC2 instance was terminated. If using spot instances (`spot: true`), switch to on-demand (`spot: false`). If already on-demand, this may be a transient EC2 issue — re-run the job.
- **"No matching instance pools"** — The requested instance family/size doesn't exist in the region. Check that the families in `.github/runs-on.yml` are available in `us-east-2`.
- **Cache miss on a warm build** — Cache keys include `hardware_arch`, `build_profile`, and a hash of all kas configs. A change to any kas file rotates all caches. S3 cache expires after 30 days.

## Contribute to documentation

The SGL website and documentation is written in Markdown and compiled into a
static website using [VitePress](https://vitepress.dev/).

### Setup the documentation environment

1. Clone the meta-sgl repository and change to the docs/ directory:
```bash
git clone https://github.com/space-grade-linux/meta-sgl
cd meta-sgl/docs/
```

2. Install VitePress and generate the website:

Prerequisites: You need Nodejs and npm (Node Package manager) to use VitePress.

```bash
npm ci
npm run docs:build
npm run docs:preview
```

### Running the documentation site locally

To preview the documentation site while you're edit the source:

```bash
npm run docs:dev
```

This will start a local development server, typically at
`http://localhost:5173`. The site will automatically reload when you make
changes to the markdown files.

### Editing documentation

The Markdown files are located in the meta-sgl/docs/. To add or modify
documentation:

1. Edit existing `.md` files or create new ones
2. Test your changes locally using `npm run docs:dev`
3. Submit a pull request with your changes

