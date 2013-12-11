/*global ares, enyo */

enyo.kind({
	name: "Harmonia",
	kind:"FittableColumns",
	events: {
		onRegisterMe: "",
		onMovePanel: ""
	},
	components: [
		{kind:"FittableRows", classes:"enyo-fit", components:[
			{kind: "onyx.Toolbar", classes: "ares-top-toolbar", components: [
				{kind: "onyx.Grabber", classes: "ares-grabber" , name: "filePanelGrabber", showing: false, ontap: "activePanel", components: [
					{kind: "aresGrabber", name: "aresGrabberDirection"}
				]},
				{classes:"ares-logo-container", name:"logoContainer", components:[
					{name:"logo", kind:"Ares.Logo"}
				]}
			]},
			{kind: "HermesFileTree", dragAllowed: true, menuAllowed: true}
		]},
		{classes:"hangar"}
	],
	debug: false,
	published: {
		// harcoded until ENYO-2755 is fixed
		panelIndex: 1
	},
	create: function() {
		ares.setupTraceLogger(this);	// Setup this.trace() function according to this.debug value
		this.inherited(arguments);
		this.doRegisterMe({name:"harmonia", reference:this});
	},
	handleSelectProvider: function(inSender, inEvent) {
		this.trace("sender:", inSender, ", event:", inEvent);
		if (inEvent.service) {
			this.$.hermesFileTree.connectService(inEvent.service);
		}
		this.$.hermesFileTree.hideFileOpButtons();
		return true; //Stop event propagation
	},
	setProject: function(project, next) {
		this.trace("project:", project);
		if (project !== null) {
			this.$.hermesFileTree.connectProject(project, next).showFileOpButtons();
		} else {
			this.$.hermesFileTree.hideFileOpButtons().clear();
			if (next) { next(); }
		}
	},
	showGrabber:function(){
		this.$.filePanelGrabber.show();
	},
	hideGrabber:function(){
		this.$.filePanelGrabber.hide();
	},
	switchGrabberDirection: function(active){
		this.$.aresGrabberDirection.switchGrabberDirection(active);
	},
	/**
	 * Refresh the {HermesFileTree}
	 * @param {Object} toSelectId - changed file id
	 * @param {Function} [callback] - optional callback
	 */
	refreshFileTree: function(toSelectId,next) {
		// the inversion of parameter is not an error.
		// next parameter is optional (can be null or undef)
		this.$.hermesFileTree.refreshFileTree(next, toSelectId);
	},
	activePanel : function(){
		this.doMovePanel({panelIndex:this.panelIndex});
	},
	showLogo:function(){
		this.$.logoContainer.show();
	},
	hideLogo:function(){
		this.$.logoContainer.hide();
	},
});
