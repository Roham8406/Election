# Election

## Container images

[Build and publish images](.github/workflows/images.yml) builds the three application
images for Linux AMD64:

| Service | Image |
| --- | --- |
| Backend API | `ghcr.io/roham8406/election/backend` |
| Frontend | `ghcr.io/roham8406/election/frontend` |
| Telegram bot | `ghcr.io/roham8406/election/bot` |

PostgreSQL uses the upstream `postgres:15-alpine` image and needs no build.
Image names follow the repository owner/name automatically, in lowercase, including
when this repository is forked or renamed.

Pull requests build all three images without logging in or publishing. Pushes to
the repository's default branch publish `latest`, the branch name, and
`sha-<full-commit-sha>` tags. Pushing a `v*` tag (for example, `v1.0.0`) publishes
that tag and the commit SHA tag. Release tags do not move `latest`.
The workflow can also be run manually from the Actions tab; manual runs publish
the selected branch/tag and SHA, and update `latest` only on the default branch.

Publishing uses the built-in `GITHUB_TOKEN` with `packages: write`; no registry
secret or personal access token is required. Repository/organization policy must
allow GitHub Actions to create packages. If a package already exists, grant this
repository Actions write access in that package's settings.

### Make the images public

GitHub creates new container packages as **private**, even for public repositories.
After the first successful publishing run, open each package under the owner's
**Packages** page, then **Package settings → Danger Zone → Change visibility →
Public**. Do this once for `election/backend`, `election/frontend`, and
`election/bot`. Later pushes retain that visibility. See
[GitHub's package visibility documentation](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility).

Once public, the images can be pulled without authentication:

```sh
docker pull ghcr.io/roham8406/election/backend:latest
docker pull ghcr.io/roham8406/election/frontend:latest
docker pull ghcr.io/roham8406/election/bot:latest
```

The frontend defaults to same-origin `/api` requests, which its Nginx config
proxies to `backend:3000`. To bake a different API origin into the frontend,
set the optional repository Actions variable `VITE_API_URL` before building.
Runtime credentials such as database passwords, JWT secrets, and Telegram tokens
must be supplied when running the containers.
