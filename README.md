# 🎛️ Monorepo

[![JSR @tugrulates](https://jsr.io/badges/@tugrulates)](https://jsr.io/@tugrulates)
[![codecov](https://codecov.io/gh/tugrulates/repo/branch/main/graph/badge.svg)](https://codecov.io/gh/tugrulates/repo)
[![ci](https://github.com/tugrulates/repo/actions/workflows/ci.yml/badge.svg)](https://github.com/tugrulates/repo/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/tugrulates/repo/blob/main/LICENSE)

Various libraries and applications, built with 🦕
[Deno](https://github.com/denoland/deno) and 🌱
[Roka](https://github.com/withroka/roka).

I maintain these for my personal use, but you are welcome to contribute.

## Packages

### 📸 500px

Interact with 500px, the photography community
([docs](https://jsr.io/@tugrulates/500px)).

```sh
deno run -N jsr:@tugrulates/500px/cli --help`
```

### 🔤 duolingo

Interact with Duolingo, the language learning platform
([docs](https://jsr.io/@tugrulates/duolingo)).

```sh
deno run -A --unstable-kv jsr:@tugrulates/duolingo/cli --help
```

### 🧳 lonely-planet

Interact with Lonely Planet, the travel guide
([docs](https://jsr.io/@tugrulates/lonely-planet)).

```sh
deno run -N jsr:@tugrulates/lonely-planet/cli --help
```

### 📸 photo

Photography editing and publishing workflow
([docs](https://jsr.io/@tugrulates/photo)).

```sh
deno run -A jsr:@tugrulates/photo/cli --help
```
