# Contributing

Thanks for your interest in AWS Community Spain! Contributions are welcome.

## Before you start

Read the [product principles](README.md#product-principles): ambiguous events are never published, data is never invented, there are no rankings between User Groups, and no LLMs or silent heuristics are used to repair content.

This repository is the permanent website. The yearly AWS Community Day sites are independent: do not copy their agenda, speakers or tickets here.

## How to contribute

- **Idea, question, bug or improvement**: open an [issue](https://github.com/alazaroc/awscommunity.es/issues/new/choose).
- **User Group change** (description, links, coordinates): edit `config/user-groups.ts` and cite the public source that backs it.
- **Code ready to go**: open a pull request.

## Development setup

Requires Node.js 22.

```bash
git clone https://github.com/alazaroc/awscommunity.es.git
cd awscommunity.es
npm ci
npm run dev        # http://localhost:4321
```

## Before opening a PR

```bash
npm test && npm run build
```

Both must pass. In addition:

- Strict TypeScript; no `any` except in defensive parsing.
- Keep data out of components (`config/` and the snapshot).
- Keep client-side JavaScript to a minimum; preserve the skip link, visible focus, `prefers-reduced-motion` and `:target`.
- New visual variables: add them first as a custom property in `src/styles/tokens.css`.
- If you touch event sources, add fixtures and tests, including incomplete input. Parsers fail closed.
- Do not include secrets or personal data.

## License

By contributing you agree that your contribution is released under the project's [MIT license](LICENSE).

The [Code of Conduct](CODE_OF_CONDUCT.md) applies.
