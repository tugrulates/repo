# Monorepo

[![JSR @tugrulates](https://jsr.io/badges/@tugrulates)](https://jsr.io/@tugrulates)
[![Coverage](https://codecov.io/gh/tugrulates/repo/branch/main/graph/badge.svg)](https://codecov.io/gh/tugrulates/repo)
[![CI](https://github.com/tugrulates/repo/actions/workflows/ci.yml/badge.svg)](https://github.com/tgurulates/repo/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/tugrulates/repo/blob/main/LICENSE)

Personal repository with various libraries and applications.

I maintain these for my personal use, but you are welcome to make contributions.

# Packages

The published packages are intended to be used with the [Deno](https://deno.com)
runtime. The documentation can be found on [JSR](https://jsr.io/@tugrulates).

# Binaries

Currently the following binary tools are available:

- `500px` - Interact with 500px, the photography community.
- `duolingo` - Interact with Duolingo, the language learning platform.
- `lonely-planet` - Interact with Lonely Planet, the travel guide.
- `photos` - Photography editing and publishing workflow.

These can be installed from the source.

```sh
git clone https://github.com/tugrulates/repo.git
cd repo
deno task install
```

You can also run the JSR packages directly.

```sh
deno run -A --unstable-kv jsr:@tugrulates/duolingo --help
```
