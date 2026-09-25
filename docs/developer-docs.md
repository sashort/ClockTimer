# Developer documentation access

The repository's `docs/` directory is not served directly by Apache. Its
`.htaccess` denies direct HTTP access.

Authenticated users with either **Developer Preview** or **Developer**
permission can browse the directory through:

```
/api/docs/
```

The endpoint:

- requires a signed-in user with Developer Preview or Developer permission;
- shows a file index when no `path` query parameter is supplied;
- resolves requested paths inside the repository `docs/` directory only;
- rejects traversal, dotfiles, directories, missing files, and symlink escapes;
- streams static documentation with an appropriate content type;
- renders `.html` documentation directly;
- executes `.php` documentation only after the permission and path checks
  have passed;
- sends private/no-store response headers.

Examples:

```
/api/docs/
/api/docs/?path=hamburger-menu.html
/api/docs/?path=example.php
```

WMOF exposes this route from **Developer → Docs**. The menu item is visible
only to users with Developer Preview or Developer UI access.
