# Minimal Mistakes remote theme starter

Click [**Use this template**](https://github.com/mmistakes/mm-github-pages-starter/generate) button above for the quickest method of getting started with the [Minimal Mistakes Jekyll theme](https://github.com/mmistakes/minimal-mistakes).

Contains basic configuration to get you a site with:

- Sample posts.
- Sample top navigation.
- Sample author sidebar with social links.
- Sample footer links.
- Paginated home page.
- Archive pages for posts grouped by year, category, and tag.
- Sample about page.
- Sample 404 page.
- Site wide search.

Replace sample content with your own and [configure as necessary](https://mmistakes.github.io/minimal-mistakes/docs/configuration/).

---

## Troubleshooting

If you have a question about using Jekyll, start a discussion on the [Jekyll Forum](https://talk.jekyllrb.com/) or [StackOverflow](https://stackoverflow.com/questions/tagged/jekyll). Other resources:

- [Ruby 101](https://jekyllrb.com/docs/ruby-101/)
- [Setting up a Jekyll site with GitHub Pages](https://jekyllrb.com/docs/github-pages/)
- [Configuring GitHub Metadata](https://github.com/jekyll/github-metadata/blob/master/docs/configuration.md#configuration) to work properly when developing locally and avoid `No GitHub API authentication could be found. Some fields may be missing or have incorrect data.` warnings.

## Vendored JS libs

`vendor/marked/` and `vendor/mermaid/` are browser builds copied in by hand rather than loaded from a CDN, per this project's `vendor/` convention -- the packages themselves are pinned as devDependencies in `package.json` purely to fetch and verify those builds, they aren't a runtime dependency of the site.

To refresh them: `npm install` then `npm run vendor` -- this copies the current build out of `node_modules` into `vendor/`, and smoke-tests each one (actually parses markdown / renders a diagram) so a broken build never gets vendored. It also prints a note if npm has a newer release than what's pinned; bump it yourself with `npm install <pkg>@latest --save-dev` when you want it, then rerun `npm run vendor`.

`npm run vendor:check` does the same checks without writing anything, and is what CI runs on every deploy (see `.github/workflows/pages.yml`) so a stale or broken vendored copy fails the build instead of shipping.
