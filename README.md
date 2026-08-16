# YipYip

![image](https://user-images.githubusercontent.com/13453719/136746212-e744bc0e-4830-4abf-9a47-59c21892d72a.png)

YipYip is an always-on search assitant that turns Gmail (and any other website) into a keyboard-first product.

Just type to search.

YipYip highlights any buttons or links in the page matching your search.

Press Tab to jump through the matches.

Press Enter to select the current match.

Voila!

Video Demo: https://www.youtube.com/watch?v=y7wGtyeEoKQ

## Extension store listings
[Google Chrome Extension](https://chrome.google.com/webstore/detail/yipyip/flbkmacappdledphgdoolmenldginemg/)\
[Firefox Extension](https://addons.mozilla.org/en-US/firefox/addon/yipyip/)\
The Chromium build can also be installed in Vivaldi.


# How it works

YipYip builds a cached index of actionable elements on the page and keeps it current with a `MutationObserver`. As the user types, searches run against the cached text and relevant attributes in small, cancellable chunks, then return the 50 highest-scoring results. This avoids rescanning the entire DOM for every keystroke.

The search interface is mounted in a Shadow DOM so its styles do not leak into the website (and the website's styles do not accidentally break it). Matching text is highlighted with the CSS Custom Highlight API and JavaScript `Range` objects, which leaves the website's DOM and event listeners untouched.

Not all attributes a node may have are relevant for our purposes, thus, YipYip only searches a specific list of attributes per node based on it's tag name. These can be found in [searchable_attributes_by_node_name.json](https://github.com/comake/yip-yip/blob/main/src/data/searchable_attributes_by_node_name.json)

In addition to matching nodes against the user's exact query, we also match against synonyms of the user's query. This helps in the case that a user describes their intention in a slightly different way than the webpage does (trash vs. delete vs. discard), especially for buttons which only display an icon and no text. We explored the idea of using a precompiled synonym library or a word similarity algorithm (like [word2vec](https://en.wikipedia.org/wiki/Word2vec)) but decided against such a "generalized" solution because the meaning of a link or button on a webpage is extremely context dependent. Instead, YipYip has a configuration file per URL host with synonyms specific to that host. Each configuration file can be thought of as mapping to an "App" used in the browser (eg. mail.google.com for Gmail, news.ycombinator.com for Hacker News).

After finding all nodes matching the user's query, we filter those nodes down to only those which we want to add selection around and allow the user to select. Serveral factors determine what gets selected:
1. If the node's tag name specifies that it's a button, link, or input
2. If the node's `role` attributte specifies that it's a button, link, or input
3. If the node matches an additional selector defined in that App's configuration file, under the `additional_button_selectors` config

We now score each of the matched buttons, links, and inputs which will be selected. These scores are used to determine which is the "best" matching node that will be selected first. Of course the "best" matching node is highly contextual based on several factors. A node's score is increased if:
- the match was made through text on the screen vs. a hidden attribute of the node,
- the match was made through the user's exact query vs. a synonym,
- the match is on the screen vs. not,
- any words in the match's fields start with the user's query vs. just including the query,
- any words in the match's fields are in the user's query and are in a list of "relevant words" in the App's configuration,
- the node matches one of the selectors in the list of "relevant selectors" in the App's configuration.

Each of these factors has a related weight which determines how much it effects the node's score.

Once the matching buttons, links, and inputs are found and sorted according to score, we add a selection box around each node and focus and scroll to the one with the highest score. A user can then press the `tab` key to jump through the matches, then press  the `enter` key to click or focus the selected button, link, or input.

## Contributing
Please use [GitHub issues](https://github.com/comake/yip-yip/issues) to report any bugs or feature requests. If you can, send in a PR and we will review.

### Work with the code

YipYip uses WXT with Vite. Node.js 24 or newer and Yarn 1.22 are required.

1. Run these commands in your terminal
```
git clone https://github.com/comake/yip-yip.git
cd yip-yip
yarn install --frozen-lockfile
yarn dev
```
2. Go to `chrome://extensions`.
3. Turn on [Developer Mode](https://developer.chrome.com/docs/extensions/mv3/faq/#faq-dev-01) in the top right.
4. Click **Load unpacked** and select `.output/chrome-mv3-dev`. WXT normally opens and reloads a development browser automatically, so manual loading is only needed when using an existing browser profile.

The build commands work on Windows, macOS, and Linux:

| Command | Output |
| --- | --- |
| `yarn dev` | Live Chromium MV3 development build in `.output/chrome-mv3-dev` |
| `yarn dev:firefox` | Live Firefox MV2 development build in `.output/firefox-mv2-dev` |
| `yarn build:chromium` | Manifest V3 build in `.output/chrome-mv3` |
| `yarn build:vivaldi` | The same Manifest V3 Chromium artifact used by Vivaldi |
| `yarn build:firefox` | Manifest V2 build in `.output/firefox-mv2` |
| `yarn build` | Both production builds |
| `yarn zip` | Browser ZIPs and a Firefox source archive in `.output` |
| `yarn quality` | Lint, test, build, and validate both targets |

Set `WXT_FIREFOX_EXTENSION_ID` to the existing AMO extension ID when preparing an update for Firefox. It is intentionally not hard-coded because changing an existing add-on's ID would create a different extension.

### Install in Vivaldi

1. Run `yarn build:vivaldi`.
2. Open `vivaldi://extensions` in Vivaldi.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select `.output/chrome-mv3`.
5. Pin YipYip from Vivaldi's extension toolbar if you want its action button to remain visible.

Like other Chromium extensions, YipYip cannot run on browser-owned pages such as `vivaldi://settings`, `vivaldi://extensions`, or the Chrome Web Store. File URLs also require **Allow access to file URLs** on the extension details page.

### Changing data
Edit the data of a specific App in `src/data/app_specific_settings/{app_name}.json`.

### Adding App Configurations
Add a new file to `src/data/app_specific_settings`, for example `google_drive.json` with the following data:

| Field | Required | Description |
| --- | --- | --- |
| `host` | Required | The [host](https://developer.mozilla.org/en-US/docs/Web/API/URL/host) portion of a URL. To obtain it for a website you're on, enter `window.location.host` into the devtools console. Beware that copying from the address bar won't always work, browsers sometimes hide the `www` portion of the URL. |
| `additional_searchable_attributes_by_node_name` | | By default YipYip only searches the attributes defined in [searchable_attributes_by_node_name.json](https://github.com/comake/yip-yip/blob/main/src/data/searchable_attributes_by_node_name.json). We chose these defaults because they are the attributes that most commonly hold text describing the meaning/function of a DOM node, which we want to search for. This field allows YipYip to search additional attributes other than the defaults. For example, on [Product Hunt](https://www.producthunt.com), most DOM nodes don't have `name`, `title`, or `aria-label` attributes. They do, however, include a `data-test` attribute which describes the meaning/function of the node in plain text. Thus, in [product_hunt.json](https://github.com/comake/yip-yip/blob/main/src/data/app_specific_settings/product_hunt.json) you can see that we add the `data-test` attribute for nodes with nodeName `BUTTON` or `TEXTAREA`. |
| `additional_button_selectors` | | By default YipYip searches for DOM nodes who's tag name or `role` attribute speficies that they are buttons, links, or inputs. These selectors are defined [here in constants.js](https://github.com/comake/yip-yip/blob/main/src/constants.js#L33-L34). If there are DOM nodes on a webpage that are clickable/focusable but don't match the default selectors, this field allows you to add additional [CSS selectors](https://www.w3schools.com/cssref/css_selectors.asp) to allow them to be matched by YipYip. |
| `relevant_selectors` | | When scoring DOM nodes to automatically highlight the best or most relevant one after a user enters a query, nodes which match a selector in this list will have their score boosted by `RELEVANT_SELECTOR_BOOST` |
| `relevant_words` | | When scoring DOM nodes to automatically highlight the best or most relevant one after a user enters a query, nodes which contain one of the words in this list when the user's query is also part of that word will have their score boosted by `RELEVANT_WORD_BOOST`. Eg. on [Product Hunt](https://www.producthunt.com), `comment` is a more relevant word than `community` when the user types `comm`. |
| `relevant_word_to_selector_mappings` | | Some DOM nodes don't contain text or attributes which give any indication of their meaning/function. This field allows some of these DOM nodes to be selected by mapping a word to a selector which matches the DOM noe. Eg. on [Product Hunt](https://www.producthunt.com), the large P icon in the orange circle in the top left is just `<a href="/">...</a>`, so we create a mapping of `home: "a[href=\"/\"]"`, which allows that link to be search for with the word `home`. |
| `synonyms` | | People have different ways of thinking about/describing what action they want to do. For example, the trash can icon on [Gmail](https://mail.google.com) may be referenced as `trash`, `delete`, or `discard` by different people. To solve for this, we add synonyms. This synonyms field is broken into two sections, `mutual`, and `directed`. `mutual` is for a set of words that all mean the same thing as eachother (eg. trash, delete, & discard). `directed` is for synonyms that we only want to be searched for in one direction (eg. I want the compose button to be selected when I type `new` but I don't want all the buttons matching `new` to be selected when I type `compose`). You can see an example of these in [gmail.json](https://github.com/comake/yip-yip/blob/main/src/data/app_specific_settings/gmail.json). |


## License
YipYip is licensed under the BSD 4 License. See [LICENSE](https://github.com/comake/yip-yip/blob/main/LICENSE)

## Maintained by
Adler Faulkner: [@adlerfaulkner](https://github.com/adlerfaulkner)

## TODOs
- [ ] Allow score weights to be changed per App config?
