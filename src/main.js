(async function() {
    'use strict';

    // Important imports
    const Patcher = await import("https://esm.sh/spitroast");
    const Immutable = await import("https://esm.sh/immutable");

    const labels = await getRecursively(() => document.getElementsByClassName("status-bar-label-text"));

    // Initialization by applying preferences
    preferenceStorage.set("realName", labels[1].textContent)
    preferenceStorage.get("name") && (labels[1].textContent = "Rosie :3");

    const AppContainer = document.getElementById("app-container");
    const ReactRoot = AppContainer._reactRootContainer._internalRoot;
    const ReactPendingProps = ReactRoot.current.child.pendingProps;
    const Contexts = ReactPendingProps.children.props.children.props.children[0];
    const SparxWebContainer = Contexts.props.children.props.children[1].type;
    
    // Component prototypes to patch (Thank god these are all class-based components!)
    const SparxWeb = SparxWebContainer.WrappedComponent.prototype;
    const WACOverlay = findReact(document.getElementsByClassName('wac-overlay')[0]);
    const StatusBar = findReact(document.getElementsByClassName("status")[0]);

    // This will adapt whenever SparxWeb re-renders
    let dynamicSubmitButton = document.getElementById("skill-delivery-submit-button");

    // Assigns submit button and props to document for easier access
    Patcher.after("render", SparxWeb, function() {
        document.__props = this.props;
        dynamicSubmitButton = document.getElementById("skill-delivery-submit-button");
    });

    // Autobookwork check bypass logic
    Patcher.after("render", WACOverlay.__proto__, function(_, res) {
        this.props.studentFirstName = preferenceStorage.get("name")
            ? cuteName
            : preferenceStorage.get("realName").split(" ")[0];

        if (!this.props.options) return;

        const answerRegexp = /[0-9]/g;
        const answers = bookworkHandler.get(this.props.bookworkCode);

        for (const option of this.props.options) {
            const optionMatches = option.get("answerMarkup")?.match(answerRegexp) ?? [0];
            const answerMatches = answers?.join("")?.match(answerRegexp) ?? [1];

            // If it thinks it has the correct answer, then submit that answer
            // This only works for Number-based answers, so images and text won't be submitted automatically
            if (optionMatches.join("").includes(answerMatches.join(""))) {
                this.props.onSubmitAnswer('', null, option, false);
                return res;
            }

            console.warn(`Couldn't find answer! Results follow;`, { optionMatches, answerMatches });
        }

        const container = findInReactTree(res, r => r.props.children[1].props.className?.includes("bookwork-code"));
        if (!container) return;

        // Repurpose the components they used - Access to a copy of React to render new components here is possible, just unnecessary
        container.props.children[0].props.children = `The answer for "${this.props.bookworkCode}" wasn't submitted and is written below.`
        container.props.children[1].props.children = ["Answer: ", answers.join("")]

        return res;
    })

    Patcher.after("render", StatusBar.__proto__, function(_, res) {
        if (!this.props.menuItems) return;

        function onToggleName() {
            const setNameToString = (value) => (labels[1].textContent = value);

            preferenceStorage.set("name", !preferenceStorage.get("name"));
            preferenceStorage.get("name") 
                ? setNameToString(cuteName) 
                : setNameToString(preferenceStorage.get("realName"));
        }

        const newItems = [
            {
                text: "Toggle name",
                img: "./img/menu_faqs.png", // Note: This can take in any image link, but the size of the icon isn't predefined
                hoverImg: "./img/menu_faqs_hover.png",
                action: onToggleName.name,
                keyBinding: null,
                newBadge: false
            }
        ]
        
        Object.assign(this.props, { onToggleName });

        // Ensure that the components from this patch haven't been added already
        for (const item of this.props.menuItems) {
            if (newItems.some(i => i.text === item.get("text"))) return;
        }

        // Reassign to menuItems as `push` returns a copy of the List
        this.props.menuItems = this.props.menuItems.push(...newItems.map(item => Immutable.fromJS(item)));
        return res;
    })

    // Listen to event for pressing the `Enter` Key and for pressing on the `Submit` button.
    dynamicSubmitButton?.addEventListener("click", storeAnswers);
    document.addEventListener("keypress", function(event) {
        event.key === "Enter" && dynamicSubmitButton && storeAnswers();
    })
})();