# Taste

## Communication
- Communicates in Brazilian Portuguese; respond in PT-BR, matching their informal, concise tone. Confidence: 0.9

## Workflow & Tooling
- Applies code changes by rebuilding the Docker container via `docker compose up -d --build --force-recreate <service>` — read `docker-compose.yml` first to identify the service to rebuild, then confirm the container is up. The user expects changes to be visible on the running instance (tests on port 3006) right after the rebuild. Confidence: 0.9
- May reject an entire batch of work with "desfaz o que você fez" and expect a full rollback to the original state (not just the last edit). Since the project has no git, keep track of every edit made so a manual revert to the pre-change state is possible. Confidence: 0.6
- Expects a diagnose-then-plan flow before edits: root-cause analysis with precise file/line references, concrete solution options (with a recommendation), a written plan file, and approval before implementing. Confidence: 0.6
