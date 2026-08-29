# circle-usage-cli
Simple CLI for Circle CI usage

## Requirements

- Node.js 22 or newer
- A CircleCI personal API token in `CIRCLE_TOKEN`

## Usage

```sh
CIRCLE_TOKEN=your-token npx circle-usage-cli
```

Pass an ISO-formatted date as the first argument to total the month containing
that date. Set `CIRCLE_MAX_MINUTE` to include the plan limit and percentage in
the output.

The token is sent in the `Circle-Token` request header and is not included in
request URLs or error messages.
