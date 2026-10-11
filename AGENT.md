1. OpenSiteBuilder is an app that allows non technical and non designer folks to create their own static website quickly.
2. It is meant to be an improvement over mainstream solutions like Wix, Canva, etc. This is done by providing the service entirely for free and with better more dynamic designs.
3. The UX is 
- Users create a GitHub account
- That GitHub account will go through authentication and authorizing OSB to perform actions on their behalf
- Users will provide the name of their web page and code we generated and the site.json shall be uploaded in a repo of that name
- Users will edit their page in a visual editor. The aspirations of the editor are minimalism, intuition by keeping to industry and user's existing experience, and yet robustness in our component selection and customizability.
- On a push, a GH Action triggers that creates the GH Page
4. Because of (3), we may always assume the user is authenticated to GitHub while they hold a valid token, and the destination of editing is GitHub and GH Pages by extension.