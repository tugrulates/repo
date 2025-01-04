# 500px ([jsr.io](https://jsr.io/@tugrulates/500px))

Interact with 500px, the photo sharing platform.

## CLI

Run `500px` after installation, or run `deno run -A @tugrulates/500px` without
installation.

### Examples

| Command                                                     | Description                                        |
| ----------------------------------------------------------- | -------------------------------------------------- |
| `500px discover`                                            | Prints a list of users with high scored photos.    |
| `500px discover --filter food`                              | Finds food photographers.                          |
| `500px discover --filter macro --filter animals`            | Either category.                                   |
| `500px discover --json \| jq`                               | Query users as JSON.                               |
| `500px follows`                                             | Prints follow counts.                              |
| `500px follows --follows`                                   | Follow users who follow.                           |
| `500px follows --unfollow`                                  | Unfollow users who dont' follow.                   |
| `500px follows --follow --unfollow`                         | Matches both lists.                                |
| `500px follows --json`                                      | Outputs JSON of follower information.              |
| `500px follows --json \| jq`                                | Query JSON for follower information.               |
| `500px follows --json \| jq '.dontFollowBack[].username'`   | List users who are followed but don't follow back. |
| `500px follows --json \| jq '.notFollowingBack[].username'` | List users who follow but are not followed back.   |
| `500px photos <username>`                                   | Prints the list of photos for a user.              |
| `500px photos <username> --json \| jq`                      | Query photos as JSON.                              |

## Classes

### [FiveHundredPxClient](https://jsr.io/@tugrulates/500px/doc/~/FiveHundredPxClient)

Client for interacting with the 500px GraphQL API.

Provides the logged out experience, and does not require authentication.

## Types

### [Category](https://jsr.io/@tugrulates/500px/doc/~/Category)

A photo category on 500px.

### [Photo](https://jsr.io/@tugrulates/500px/doc/~/Photo)

A photo submitted to 500px and its stats.

### [User](https://jsr.io/@tugrulates/500px/doc/~/User)

A user on 500px.

## Constants

### [CATEGORIES](https://jsr.io/@tugrulates/500px/doc/~/CATEGORIES)

Photo categories on 500px.

Each photo belongs to a single category.
