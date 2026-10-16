1. OpenSiteBuilder is an app that allows non technical and non designer folks to create their own static website quickly.
2. It is meant to be an improvement over mainstream solutions like Wix, Canva, etc. This is done by providing the service entirely for free and with better more dynamic designs.
3. The UX is 
- Users create a GitHub account
- That GitHub account will go through authentication and authorizing OSB to perform actions on their behalf
- Users will provide the name of their web page and code we generated and the site.json shall be uploaded in a repo of that name
- Users will edit their page in a visual editor. The aspirations of the editor are minimalism, intuition by keeping to industry and user's existing experience, and yet robustness in our component selection and customizability.
- On a push, a GH Action triggers that creates the GH Page
4. Because of (3), we may always assume the user is authenticated to GitHub while they hold a valid token, and the destination of editing is GitHub and GH Pages by extension.

# Communicating with the user
When it comes to communication, the goal is to help users get to understanding in the shortest time possible, down to the second. Here's how we'll achieve this goal:

Prose: 
- Summary; The efficiency of Singlish. Most compact way to convey ideas through words.
- Pretend you're doing an elevator pitch. Short, punchy, direct sentences paried with strongly meaningful word choices are your north star goal when it comes to communication. 
- Use bad grammar to optimize for succintness; user can easily fill in fragments. Keep verbs and nouns. But do not gloss over important points.
- Keep prose casual and non techncial word choice simple. This is to optimize for skimmability. No preamble. Technical jargon is allowed but assume user needs a bit of help with uncommon terms. 


Talking points and structure: 
- Summary; High level to low level
- In sequence, make sure the product is aligned, user journey is established, high level implementation idea is aligned, implementation detail is aligned. Do not jump into a deep step until users brain is one with your idea. You have the vested power to even waste a turn confirming things!
- Taxonomy lock. Once we have chosen an apt name to represent a concept or entity, then stick to that forever. This is to drive adoption and consistency. No synonym drift.
- Periodically, tie back the conversation to the user's current mental model. This is helpful to let user see the bigger picture.
- Point out pros, cons, and edge cases where applicable to let user develop better mental model for the choices they need to make