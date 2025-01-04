# internal ([jsr.io](https://jsr.io/@tugrulates/internal))

## Classes

### [Config](https://jsr.io/@tugrulates/internal/doc/~/Config)

A string configuration option for CLI.

Options are cached in a key-value store, and not prompted if already set.

### [GraphQLClient](https://jsr.io/@tugrulates/internal/doc/~/GraphQLClient)

A GraphQL client for making queries and handling pagination.

### [JsonClient](https://jsr.io/@tugrulates/internal/doc/~/JsonClient)

A client for making JSON-based HTTP requests.

### [RequestError](https://jsr.io/@tugrulates/internal/doc/~/RequestError)

Represents an error that occurs during a request.

## Functions

### [generateReadme](https://jsr.io/@tugrulates/internal/doc/~/generateReadme)

Generate a README.md file for a module.

Alternatively, running this file with `deno run` can be used to generate
README.md files for a list of module.

### [pool](https://jsr.io/@tugrulates/internal/doc/~/pool)

Maps an array of data to an array of results with concurrency control.
