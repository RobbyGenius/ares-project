/*global Ares, ServiceRegistry, enyo, async, ares, alert, ComponentsRegistry, $L */

enyo.path.addPaths({
	"assets"	: "$enyo/../assets",
	// deprecated aliases
	"utilities"	: "$enyo/../utilities",
	"services"	: "$enyo/../services",
	"phobos"	: "$enyo/../phobos",
	"deimos"	: "$enyo/../deimos",
	"harmonia"	: "$enyo/../harmonia",
	"project-view"	: "$enyo/../project-view"
});

enyo.kind({
	name: "Ares",
	kind: "Control",
	classes: "onyx",
	fit: true,
	debug: false,
	//noDefer: true, //FIXME: does not work with statics:{}
	components: [
		{
			name:"aresLayoutPanels",
			kind: "Panels",
			draggable: false,
			arrangerKind: "CollapsingArranger",
			fit: true,
			classes:"ares-main-panels enyo-border-box",
			onTransitionFinish:"changeGrabberDirection",
			components:[
				{
					name: "projectView",
					kind: "ProjectView",
					classes: "ares-panel-min-width "
				},
				{
					kind: "Harmonia",
					name: "harmonia",
					classes: "ares-panel-min-width enyo-fit",
					onFileDblClick: "openDocument",
					onFileChanged: "_closeDocument",
					onFolderChanged: "closeSomeDocuments"
				},
				{kind: "Ares.EnyoEditor", name: "enyoEditor"}
			]
		},
		{
			name: "waitPopup",
			kind: "onyx.Popup",
			centered: true,
			floating: true, 
			autoDismiss: false,
			modal: true,
			style: "text-align: center; padding: 20px; width: 200px;",
			components: [
				{kind: "Image", src: "$phobos/assets/images/save-spinner.gif", style: "width: 54px; height: 55px;"},
				{name: "waitPopupMessage", content: "Ongoing...", style: "padding-top: 10px;"}, 
				{kind: "onyx.Button", name:"canceBuildButton", content: "Cancel", ontap: "cancelService", style: "margin-top: 10px;", showing: false}						
			]
		},
		
		{name: "errorPopup", kind: "Ares.ErrorPopup", msg: "unknown error", details: ""},
		{name: "signInErrorPopup", kind: "Ares.SignInErrorPopup", msg: "unknown error", details: ""},
		{kind: "ServiceRegistry"},
		{kind: "Ares.PackageMunger", name: "packageMunger"}
	],
	handlers: {
		onReloadServices: "handleReloadServices",
		onUpdateAuth: "handleUpdateAuth",
		onShowWaitPopup: "showWaitPopup",
		onHideWaitPopup: "hideWaitPopup",
		onError: "showError",
		onErrorTooltip: "showDesignerErrorTooltip",
		onErrorTooltipReset: "resetDesignerErrorTooltip",
		onDesignerBroken: "showDesignerError",
		onSignInError: "showAccountConfiguration",
		onTreeChanged: "_treeChanged",
		onFsEvent: "_fsEventAction",
		onChangingNode: "_nodeChanging",
		onAllDocumentsAreClosed: "showProjectView",
		onCloseProjectDocuments: "closeDocumentsForProject",
		onDesignDocument: "designDocument", 
		onUpdate: "phobosUpdate",
		onCloseDesigner: "closeDesigner", 
		onUndo: "designerUndo", 
		onRedo: "designerRedo",
		onRegisterMe : "_registerComponent",
		onMovePanel : "_movePanel"
	},
	projectListIndex: 0,
	hermesFileTreeIndex: 1,
	enyoEditorIndex: 2,
	phobosViewIndex: 0,
	deimosViewIndex: 1,
	projectListWidth: 300,
	isProjectView: true,
	create: function() {
		ares.setupTraceLogger(this);		// Setup this.trace() function according to this.debug value
		this.inherited(arguments);
		this._registerComponent(null,{name: "ares", reference: this});
		ComponentsRegistry.getComponent("enyoEditor").$.panels.setIndex(this.phobosViewIndex);
		ServiceRegistry.instance.setOwner(this); // plumb services events all the way up
		window.onbeforeunload = enyo.bind(this, "handleBeforeUnload");
		if (Ares.TestController) {
			Ares.Workspace.loadProjects("com.enyojs.ares.tests", true);
			this.createComponent({kind: "Ares.TestController", aresObj: this});
		} else {
			Ares.Workspace.loadProjects();
		}

		Ares.instance = this;
	},

	rendered: function() {
		this.inherited(arguments);
		this.showProjectView();
	},
	/**
	 * @private
	 */
	handleReloadServices: function(inSender, inEvent) {
		this.trace("sender:", inSender, ", event:", inEvent);
		this.$.serviceRegistry.reloadServices();
	},
	/**
	 * @private
	 */
	handleUpdateAuth: function(inSender, inEvent) {
		this.trace("sender:", inSender, ", event:", inEvent);
		this.$.serviceRegistry.setConfig(inEvent.serviceId, {auth: inEvent.auth}, inEvent.next);
	},
	openDocument: function(inSender, inEvent) {
		this._openDocument(inEvent.projectData, inEvent.file, function(inErr) {});
	},
	/** @private */
	_openDocument: function(projectData, file, next) {
		var fileDataId = Ares.Workspace.files.computeId(file);
		var editor = ComponentsRegistry.getComponent("enyoEditor");
		if (! fileDataId ) {
			throw new Error ('Undefined fileId for file ' + file.name + ' service ' + file.service);
		}
		var fileData = Ares.Workspace.files.get(fileDataId);
		this.trace("open document with project ", projectData.getName(),
				   " file ", file.name, " using cache ", fileData);

		if (fileData) {
			// useful when double clicking on a file in HermesFileTree
			editor.switchToDocument(fileData, next) ;
		} else {
			this.showWaitPopup(this, {msg: $L("Opening...")});
			async.waterfall(
				[
					this._fetchDocument.bind(this,projectData, file),
					editor.switchToNewTabAndDoc.bind(editor,projectData,file),
					this._hideWaitPopup.bind(this)
				],
				next
			);
		}

		// hide projectView only the first time a file is opened in a project
		// otherwise, let the user handle this
		if (! Ares.Workspace.files.length ) {
			this.hideProjectView();
		}
	},

	/** @private */
	_fetchDocument: function(projectData, file, next) {
		this.trace("projectData:", projectData.getName(), ", file:", file.name);
		var service = projectData.getService();
		service.getFile(file.id)
			.response(this, function(inEvent, inData) {
				next(null, inData && inData.content || "");
			})
			.error(this, function(inEvent, inErr) {
				next(inErr);
			});
	},
	/* @private */
	// close documents contained in a folder after a folder rename.
	// One might say that these documents are canon folder...
	closeSomeDocuments: function(inSender, inEvent) {
		this.trace("sender:", inSender, ", event:", inEvent);
		
		var files = Ares.Workspace.files,
			model,
			i;
		
		for( i = 0; i < files.models.length; i++ ) {
			model = files.models[i];

			var path = model.getFile().path,
				serviceId = model.getProjectData().getServiceId();

			if ( serviceId == inEvent.projectData.getServiceId() && path.indexOf( inEvent.file.path, 0 ) >= 0 ) {
				this._closeDocument(model.id);
				i--;
			}
		}
	},
	/** @private */
	_closeDocument: function(docId, next) {
		ComponentsRegistry.getComponent("enyoEditor").closeDoc(docId,next);
	},
	/** @private */
	_fsEventAction: function(inSender, inEvent) {
		var harmonia = ComponentsRegistry.getComponent("harmonia");
		harmonia.refreshFileTree(inEvent.nodeId);
	},

	designDocument: function(inSender, inEvent) {
		// send all files being edited to the designer, this will send code to designerFrame
		this.syncEditedFiles(inEvent.projectData);
		// then load palette and inspector, and tune serialiser behavior sends option data to designerFrame
		ComponentsRegistry.getComponent("deimos").loadDesignerUI(inEvent);
		// switch to Deimos editor
		ComponentsRegistry.getComponent("enyoEditor").$.panels.setIndex(this.deimosViewIndex);
		// update an internal variable
		ComponentsRegistry.getComponent("enyoEditor").activeDocument.setCurrentIF('designer');
	},
	//* A code change happened in Phobos - push change to Deimos
	phobosUpdate: function(inSender, inEvent) {
		ComponentsRegistry.getComponent("deimos").loadDesignerUI(inEvent);
	},
	// FIXME 3082 handle this in  by Enyoeditor
	closeDesigner: function(inSender, inEvent) {
		ComponentsRegistry.getComponent("phobos").updateComponentsCode(inEvent);
		ComponentsRegistry.getComponent("enyoEditor").$.panels.setIndex(this.phobosViewIndex);
		ComponentsRegistry.getComponent("enyoEditor").activeDocument.setCurrentIF('code');
		ComponentsRegistry.getComponent("enyoEditor").manageControls(false);
	},
	//* Undo event from Deimos
	designerUndo: function(inSender, inEvent) {
		ComponentsRegistry.getComponent("phobos").undoAndUpdate();
	},
	//* Redo event from Deimos
	designerRedo: function(inSender, inEvent) {
		ComponentsRegistry.getComponent("phobos").redoAndUpdate();
	},
	handleBeforeUnload: function() {
		if (window.location.search.indexOf("debug") == -1) {
			return 'You may have some unsaved data';
		}
	},
	/**
	 * The width of the panel needs to be calculated en function of width of the previous panel
	 * if the panel is not the last panel of arranger 
	 * and we want that this panel take place of all remaining screen after display of all previous panels

	 * @private
	 * @param {Object} panel
	 */
	_calcPanelWidth:function(panel) {
		var cn = this.$.aresLayoutPanels.hasNode();
		this.aresContainerBounds = cn ? {width: cn.clientWidth, height: cn.clientHeight} : {};
		panel.applyStyle("width", (this.aresContainerBounds.width - this.projectListWidth) + "px");
	},
	hideProjectView: function(inSender, inEvent) {
		this.isProjectView = false;
		this.$.aresLayoutPanels.getPanels()[this.hermesFileTreeIndex].applyStyle("width", null);
		var harmonia = ComponentsRegistry.getComponent("harmonia");
		harmonia.addClass("ares-small-screen");
		this.$.aresLayoutPanels.reflow();
		this.$.aresLayoutPanels.setIndexDirect(this.hermesFileTreeIndex);
		harmonia.showGrabber();
		harmonia.hideLogo();
	},
	showProjectView: function(inSender, inEvent) {
		this.isProjectView = true;
		var harmonia = ComponentsRegistry.getComponent("harmonia");
		harmonia.removeClass("ares-small-screen");		
		this.$.aresLayoutPanels.setIndex(this.projectListIndex);
		this.$.aresLayoutPanels.getPanels()[this.enyoEditorIndex].switchGrabberDirection(false);
		this._calcPanelWidth(this.$.aresLayoutPanels.getPanels()[this.hermesFileTreeIndex]);
		this.$.aresLayoutPanels.reflow();
		harmonia.hideGrabber();
		harmonia.showLogo();
	},
	changeGrabberDirection:function(inSender, inEvent){
		if(inEvent.toIndex > 0 && inEvent.fromIndex < inEvent.toIndex){
			for(var i = 1; i<=inEvent.toIndex; i++){
				this.$.aresLayoutPanels.getPanels()[i].switchGrabberDirection(true);
			}
		}
		if(inEvent.fromIndex>inEvent.toIndex){
			this.$.aresLayoutPanels.getPanels()[inEvent.fromIndex].switchGrabberDirection(false);
		}
	},
	/** @private */
	_movePanel: function(inSender, inEvent){
		if(inEvent.panelIndex === this.$.aresLayoutPanels.getIndex()){
			this.$.aresLayoutPanels.previous();
		}else{
			this.$.aresLayoutPanels.setIndex(inEvent.panelIndex);
		}
	},
	resizeHandler: function(inSender, inEvent) {
		this.inherited(arguments);
		if(this.$.aresLayoutPanels.getIndex() === this.projectListIndex && this.isProjectView){
			this._calcPanelWidth(this.$.aresLayoutPanels.getPanels()[this.hermesFileTreeIndex]);
		}
	},

	//* Update code running in designer
	syncEditedFiles: function(project) {
		// project is a backbone Ares.Model.Project defined in WorkspaceData.js
		var projectName = project.getName();
		this.trace("update all edited files on project", projectName);
		
		function isProjectFile(model) {
			return model.getFile().name !== "package.js"
				&& model.getProjectData().getName() === projectName ;
		}
		// backbone collection
		Ares.Workspace.files.filter(isProjectFile).forEach(this.updateCode,this);
	},

	updateCode: function(inDoc) {
		// inDoc is a backbone Ares.Model.File defined in FileData.js
		var filename = inDoc.getFile().path,
			aceSession = inDoc.getAceSession(),
			code = aceSession && aceSession.getValue();
		// project is a backbone Ares.Model.Project defined in WorkspaceData.js
		var projectName = inDoc.getProjectData().getName();
		this.trace('code update on file', filename,' project ' + projectName);

		ComponentsRegistry.getComponent("deimos").syncFile(projectName, filename, code);
	},

	showWaitPopup: function(inSender, inEvent) {
		if(inEvent.service === 'build' && ! inEvent.msg.match(/Starting/)) {
			// Node server fails if cancel is done during "Starting build" phase
			// See ENYO-3506
			this.$.canceBuildButton.show();
		}
		this.$.waitPopupMessage.setContent(inEvent.msg);
		this.$.waitPopup.show();
	},

	cancelService: function(inSender, inEvent) {
		enyo.Signals.send("plugin.phonegap.buildCanceled");
		this.hideWaitPopup();		
	},

	hideWaitPopup: function(inSender, inEvent) {
		this._hideWaitPopup(function(){});
	},
	_hideWaitPopup: function(next) {
		this.$.canceBuildButton.hide();
		this.$.waitPopup.hide();
		next();
	},

	showError: function(inSender, inEvent) {
		this.trace("event:", inEvent, "from sender:", inSender);
		this.hideWaitPopup();		
		if (inEvent && inEvent.err && inEvent.err.status === 401) {
			this.showSignInErrorPopup(inEvent);
		} else {
			this.showErrorPopup(inEvent);
		}
		
		return true; //Stop event propagation
	},
	showErrorPopup : function(inEvent) {
		this.$.errorPopup.raise(inEvent);
	},
	showDesignerErrorTooltip: function(inSender, inEvent){
		ComponentsRegistry.getComponent("enyoEditor").showErrorTooltip(inSender, inEvent);
	},
	resetDesignerErrorTooltip: function(inSender, inEvent){
		ComponentsRegistry.getComponent("enyoEditor").resetErrorTooltip();
	},
	showDesignerError: function(){
		this.showError("",ComponentsRegistry.getComponent("enyoEditor").getErrorFromDesignerBroken());
	},
	showSignInErrorPopup : function(inEvent) {
		this.$.signInErrorPopup.raise(inEvent);
	},
	showAccountConfiguration: function() {
		ComponentsRegistry.getComponent("accountsConfigurator").show();		
		this.$.signInErrorPopup.hide();		
	},
	/**
	 * Event handler for user-initiated file or folder changes
	 * 
	 * @private
	 * @param {Object} inSender
	 * @param {Object} inEvent as defined by calls to HermesFileTree#doTreeChanged
	 */
	_treeChanged: function(inSender, inEvent) {
		this.trace("sender:", inSender, ", event:", inEvent);
		this.$.packageMunger.changeNodes(inEvent, (function(err) {
			if (err) {
				this.warn(err);
			}
		}).bind(this));
	},
	/**
	 * Event handler for system-initiated file or folder changes
	 * 
	 * @private
	 * @param {Object} inSender
	 * @param {Object} inEvent as defined by calls to Ares.PackageMunger#doChangingNode
	 */
	_nodeChanging: function(inSender, inEvent) {
		this.trace("sender:", inSender, ", event:", inEvent);
		var docId = Ares.Workspace.files.computeId(inEvent.node);
		this._closeDocument(docId);
	},
	/**
	 * Event handler for to close opened documents of a project
	 * 
	 * @private
	 * @param {Object} inSender
	 * @param {Object} inEvent => inEvent.project in Ares.Model.Project
	 */
	closeDocumentsForProject: function(inSender, inEvent){
		var files = Ares.Workspace.files,
			model,
			i;
		for( i = 0; i < files.models.length; i++ ) {
			model = files.models[i];

			var serviceId = model.getProjectData().getServiceId();
			var folderId = model.getProjectData().getFolderId();
			if ( serviceId === inEvent.project.getServiceId() && folderId === inEvent.project.getFolderId()) {
				this._closeDocument(model.id);
				i--;
			}
		}
	},
	/**
	 * Event handler for ares components registry
	 * 
	 * @private
	 * @param {Object} inSender
	 * @param {Object} inEvent => inEvent.name in [phobos, deimos, projectView, documentToolbar, harmonia, enyoEditor, accountsConfigurator, ...]
	 */
	_registerComponent: function(inSender, inEvent) {
		ComponentsRegistry.registerComponent(inEvent);

		return true;
	},
	stopEvent: function(){
		return true;
	},
	statics: {
		isBrowserSupported: function() {
			if (enyo.platform.ie && enyo.platform.ie <= 8) {
				return false;
			} else {
				return true;
			}
		},
		instance: null
	}
});

if ( ! Ares.isBrowserSupported()) {
	alert($L("Ares is designed for the latest version of IE. We recommend that you upgrade your browser or use Chrome"));
}

/**
 * Manages registered components
 * 
 * @class ComponentRegistry
 * @augments enyo.Object
 */
enyo.kind({
	name: "ComponentsRegistry",
	debug: false,
	kind: "enyo.Object",
	statics: {
		components: {},
		/** @public */
		registerComponent: function(inEvent) {
			var ref = ComponentsRegistry.components[inEvent.name];
			if (ref === undefined || ref === inEvent.reference){
				ComponentsRegistry.components[inEvent.name] = inEvent.reference;
			} else {
				throw new Error("Component is already registred: '" + inEvent.name + "'");
			}
		},
		getComponent: function(name) {
			return ComponentsRegistry.components[name];
		}
	}
});
