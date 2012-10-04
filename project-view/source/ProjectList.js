enyo.kind({
	name: "ProjectList",
	classes: "enyo-unselectable",
	events: {
		onCreateProject: "",
		onProjectSelected: "",
		onOpenProject: "",
		onProjectRemoved: ""
	},
	handlers: {
	},
	projects: [],
	components: [
	    {kind: "LocalStorage"},
	    {kind: "onyx.Toolbar",  classes: "onyx-menu-toolbar", isContainer: true, name: "toolbar", components: [
			{content: "Projects", style: "margin-right: 10px"},
			 // FIXME: we may need icons dedicated for projects instead of re-using application icons
			{kind: "onyx.TooltipDecorator", components: [
				{kind: "onyx.IconButton", src: "$harmonia/images/application_new.png", onclick: "doCreateProject"},
				{kind: "onyx.Tooltip", content: "Create Project..."},
			]},
			{kind: "onyx.TooltipDecorator", components: [
				{kind: "onyx.IconButton", src: "$harmonia/images/application_edit.png", onclick: "doOpenProject"},
				{kind: "onyx.Tooltip", content: "Open Project..."},
			]},
			{kind: "onyx.TooltipDecorator", components: [
				{kind: "onyx.IconButton", src: "$harmonia/images/delete.png", onclick: "removeProjectAction"},
				// FIXME: tooltip goes under File Toolbar, there's an issue with z-index stuff
				{kind: "onyx.Tooltip", content: "Remove Project..."},
			]},
		]},
	    {kind: "enyo.Scroller", components: [
			{kind: "enyo.Repeater", controlParentName: "client", fit: true, name: "projectList", onSetupItem: "projectListSetupItem", ontap: "projectListTap", components: [
                {kind: "Project", name: "item", classes: "enyo-children-inline ares_projectView_projectList_item"}
            ]}
		]},
		{kind: "RemoveProjectPopup", onConfirmDeleteProject: "confirmRemoveProject"}
    ],
	PROJECTS_STORAGE_KEY: "com.enyojs.ares.projects",
	selected: null,
	create: function() {
		this.inherited(arguments);
		this.$.localStorage.get(this.PROJECTS_STORAGE_KEY, enyo.bind(this, this.projectListAvailable));
	},
	/**
	 * Callback functions which receives the project list data read from the storage
	 * @protected
	 * @param data: the project list in json format
	 */
	projectListAvailable: function(data) {
		try {
			if (data && data !== "") {
				this.projects = JSON.parse(data);
			}
			this.$.projectList.setCount(this.projects.length);
		} catch(error) {
			this.error("Unable to retrieve projects information: " + error);	// TODO ENYO-1105
			console.dir(data);		// Display the offending data in the console
			this.$.localStorage.remove(this.PROJECTS_STORAGE_KEY); // Remove incorrect projects information
		}
	},
	storeProjectsInLocalStorage: function() {
		var projectsString;
		try {
			projectsString = JSON.stringify(this.projects, enyo.bind(this, this.stringifyReplacer));
		} catch(error) {
			this.error("Unable to store the project information: " + error);	// TODO ENYO-1105
			console.dir(this.projects);		// Display the offending object in the console
			return;
		}
		this.$.localStorage.set(this.PROJECTS_STORAGE_KEY, projectsString, function() {
			// WARNING: LocalStorage does not return any information about operation status (success or error)
			enyo.log("Project list saved");
		});
	},
	addProject: function(name, folderId, serviceId) {
		var project = {name: name, folderId: folderId, serviceId: serviceId};
		this.projects.push(project);
		this.storeProjectsInLocalStorage();
		this.$.projectList.setCount(this.projects.length);
		this.$.projectList.render();
	},
	removeProjectAction: function(inSender, inEvent) {
		if (this.selected) {
			this.$.removeProjectPopup.setName(this.selected.getProjectName());
			this.$.removeProjectPopup.show();
		}
	},
	confirmRemoveProject: function(inSender, inEvent) {
		if (this.selected) {
			this.projects.splice(this.selected.index, 1);
			this.storeProjectsInLocalStorage();
			this.selected = null;
			this.$.projectList.setCount(this.projects.length);
			this.$.projectList.render();
			this.doProjectRemoved();
		}
	},
	projectListSetupItem: function(inSender, inEvent) {
	    var project = this.projects[inEvent.index];
	    var item = inEvent.item;
	    // setup the controls for this item.
	    item = item.$.item;
	    item.setProjectName(project.name);
	    item.setIndex(inEvent.index);
	},
    projectListTap: function(inSender, inEvent) {
    	if (this.selected) {
    		this.selected.removeClass("ares_projectView_projectList_item_selected");
    	}
    	this.selected = inEvent.originator;
    	this.selected.addClass("ares_projectView_projectList_item_selected");
    	this.doProjectSelected(this.projects[inEvent.index]);
    },
    stringifyReplacer: function(key, value) {
    	if (key === "originator") {
    		return undefined;	// Exclude
    	}
    	return value;	// Accept
    }
});

enyo.kind({
	name: "Project",
	published: {
		projectName: "",
		index: -1
	},
	components: [
	    {name: "name"}
	],
	projectNameChanged: function(inOldValue) {
        this.$.name.setContent(this.projectName);
    }
});

enyo.kind({
	name: "RemoveProjectPopup",
	kind: "onyx.Popup",
	published: {
		name: ""
	},
	events: {
		onConfirmDeleteProject: ""
	},
	modal: true,
	centered: true,
	floating: true,
	autoDismiss: false,
	components: [
	    {name: "title", tag: "h3", content: "Delete?"},
	    {tag: "br"},
	    {tag: "br"},
	    {kind: "onyx.Button", classes: "onyx-negative", content: "Cancel", ontap: "deleteCancel"},
	    {kind: "onyx.Button", classes: "onyx-affirmative", content: "Delete", ontap: "deleteConfirm"}
    ],
	nameChanged: function() {
		this.$.title.setContent("Delete project \"" + this.name + "\" ?");
	},
	deleteCancel: function(inSender, inEvent) {
	    this.hide();
	},
	deleteConfirm: function(inSender, inEvent) {
	    this.hide();
	    this.doConfirmDeleteProject();
	}
});