# lonely-planet ([jsr.io](https://jsr.io/@tugrulates/lonely-planet))

Interactions with Lonely Planet, the travel guide website.

## CLI

Run `lonely-planet` after installation, or run
`deno run -A @tugrulates/lonely-planet` without installation.

### Examples

| Command                                                | Description                        |
| ------------------------------------------------------ | ---------------------------------- |
| `lonely-planet big sur`                                | Search destinations for 'big sur'. |
| `lonely-planet --attractions amsterdam`                | Search attractions.                |
| `lonely-planet --stories amsterdam`                    | Search stories.                    |
| `lonely-planet --destinations --attractions --stories` | All.                               |
| `lonely-planet --json \| jq`                           | Stream destinations as json.       |

## Classes

### [LonelyPlanetClient](https://jsr.io/@tugrulates/lonely-planet/doc/~/LonelyPlanetClient)

Client for interacting with the Lonely Planet API.

Requires credentials to the Typesense API, which can be obtained from the Lonely
Planet frontend.

## Types

### [Attraction](https://jsr.io/@tugrulates/lonely-planet/doc/~/Attraction)

A Lonely Planet attraction.

### [Breadcrumb](https://jsr.io/@tugrulates/lonely-planet/doc/~/Breadcrumb)

Global path component of a Lonely Planet document.

### [Destination](https://jsr.io/@tugrulates/lonely-planet/doc/~/Destination)

A Lonely Planet destination.

### [Document](https://jsr.io/@tugrulates/lonely-planet/doc/~/Document)

A Lonely Planet document.

### [Image](https://jsr.io/@tugrulates/lonely-planet/doc/~/Image)

A Lonely Planet image.

### [Story](https://jsr.io/@tugrulates/lonely-planet/doc/~/Story)

A Lonely Planet story.

## Constants

### [EMOJIS](https://jsr.io/@tugrulates/lonely-planet/doc/~/EMOJIS)

Lonely Planet document type emojis.
