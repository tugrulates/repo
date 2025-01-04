# lib

Monorepo with various libraries and tools.

I maintain these for my personal use, but you are welcome to make contributions.
My plan is to makee a release version of any component that becomes useful.

# Library

The library is intended to be used with the [Deno](https://deno.com) runtime.
The documentation can be found on [JSR](https://jsr.io/@tugrulates).

# Tools

Currently the following tools are available:

- `500px` - Interact with 500px, the photography community.
- `duolingo` - Interact with Duolingo, the language learning platform.
- `lonely-planet` - Interact with Lonely Planet, the travel guide.
- `photos` - Photography editing and publishing workflow.

These can be installed from the source.

```sh
git clone https://github.com/tugrulates/lib.git
cd lib
deno task install
```

You can also run the JSR packages directly.

```sh
deno run -A --unstable-kv jsr:@tugrulates/duolingo --help
```
