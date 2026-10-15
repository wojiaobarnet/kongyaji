# Project maintenance

The owner requires every website change to be synchronized with the project documentation and this GitHub repository.

- Update `README.md`, `deploy/README.md`, `docs/给接手AI的部署说明.txt`, and relevant sections of `docs/项目文档.md` whenever behavior, deployment, routes, or maintenance steps change.
- Regenerate `docs/项目文档.pdf` from the Markdown and visually check it. Record each change and its validation in `docs/CHANGELOG.md`.
- Commit and publish code and documentation together to `wojiaobarnet/kongyaji`, preserving unrelated upstream changes. Verify the published commit and its files. Report publication blockers rather than claiming a local-only change was synchronized.
- Never commit SSH keys, administrator passwords, production secrets, databases, uploads, browser sessions, or test data.
- Preserve `/donghan/`, `/donghan/uguest/`, existing server sites, and `/var/lib/donghan` unless the owner requests a change.
- The current primary host is `43.128.69.6` on BT Panel/OpenCloudOS. Verify live state before deployment. Its nginx vhost is `/www/server/panel/vhost/nginx/43.128.69.6.conf`; use the BT nginx binary, not the old Ubuntu `/etc/nginx` layout. The old `159.75.67.132` instance remains separate; do not stop it or assume its database synchronizes with the primary host.
- ZIP files in `deliverables/` are historical initial snapshots. Use current branch source and update instructions for later versions.
