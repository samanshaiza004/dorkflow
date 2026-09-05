# Holdout public metadata

This directory contains lifecycle records and bundle hashes only.

Sealed holdout rendered bundles, seeds, instantiated sources, and ground
truth live outside the coding-agent workspace in the directory supplied by
`DORKFLOW_SEALED_STORE`. The generator refuses to reuse an existing sealed
benchmark ID. Do not copy private holdout inputs into this repository.
