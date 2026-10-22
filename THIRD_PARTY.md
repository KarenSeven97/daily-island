# Third-party software

`dist/supabase-sdk.js` contains the official `@supabase/supabase-js` browser bundle, pinned to version **2.118.0**, from the npm registry tarball. The tarball was checked against its published SHA-512 integrity value:

`sha512-FxI8UXMVC2UG7IkeiI8fuQZqq2oI3JeSuN8MPIC2RLVaoEAxKS0nqE6kii9Ewpq8f9gNPM6git1Y8f0vN/QLFw==`

The only local change is an appended `export {supabase};` declaration so the official browser bundle can be loaded as a local ES module. It is loaded asynchronously by the account adapter. Guest gameplay does not wait for authentication initialization or a network request. The SDK is included in the PWA shell cache.

License: MIT, reproduced in `dist/supabase-sdk.LICENSE.txt`.

Source: https://github.com/supabase/supabase-js

Registry package: https://www.npmjs.com/package/@supabase/supabase-js/v/2.118.0
