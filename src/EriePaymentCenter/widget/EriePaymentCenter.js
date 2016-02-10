/*jslint nomen: true*/
/*global logger, define, require*/
/*
    EriePaymentCenter
    ========================

    @file      : EriePaymentCenter.js
    @version   : 0.1
    @author    : Eric Tieniber
    @date      : Tue, 09 Feb 2016 21:34:51 GMT
    @copyright : 
    @license   : Apache 2

    Documentation
    ========================
    Describe your widget here.
*/

// Required module list. Remove unnecessary modules, you can always get them back from the boilerplate.
define([
    "dojo/_base/declare",
    "mxui/widget/_WidgetBase",
    "dijit/_TemplatedMixin",

    "mxui/dom",
    "dojo/dom",
    "dojo/dom-prop",
    "dojo/dom-geometry",
    "dojo/dom-class",
    "dojo/dom-style",
    "dojo/dom-construct",
    "dojo/_base/array",
    "dojo/_base/lang",
    "dojo/text",
    "dojo/html",
    "dojo/_base/event",

    "EriePaymentCenter/lib/jquery-1.11.2",
    "dojo/text!EriePaymentCenter/widget/template/EriePaymentCenter.html"
], function (declare, _WidgetBase, _TemplatedMixin, dom, dojoDom, dojoProp, dojoGeometry, dojoClass, dojoStyle, dojoConstruct, dojoArray, dojoLang, dojoText, dojoHtml, dojoEvent, _jQuery, widgetTemplate) {
    "use strict";

    var $ = _jQuery.noConflict(true);

    // Declare widget's prototype.
    return declare("EriePaymentCenter.widget.EriePaymentCenter", [ _WidgetBase, _TemplatedMixin ], {
        // _TemplatedMixin will create our dom node using this HTML template.
        templateString: widgetTemplate,

        // DOM elements
        domNode: null,

        // Parameters configured in the Modeler.
        urlParam: "",
		customDivID: "",
		transactionType: "",
		reqIdentifier: "",
		
		//Button classes used for actions outside of iframe
		drgContinue: "",
		drgContinueError: "",
		drgSubmit: "",
		drgSubmitDown: "",
		drgSubmitNo: "",
		drgContinueChange: "",
		drgContinueChangeError: "",

        // Internal variables. Non-primitives created in the prototype are shared between all widget instances.
        _contextObj: null,
        _alertDiv: null,
		_paymentCenter: null,
		_pid: null,
		_transactionTypeData: "",
		_reqIdentifierData: "",
		
        // dojo.declare.constructor is called to construct the widget instance. Implement to initialize non-primitive properties.
        constructor: function () {
            // Uncomment the following line to enable debug messages
            logger.level(logger.DEBUG);
            logger.debug(this.id + ".constructor");
        },

        // dijit._WidgetBase.postCreate is called after constructing the widget. Implement to do extra setup work.
        postCreate: function () {
            logger.debug(this.id + ".postCreate");
			
			this.startSpinner("");
        },

        // mxui.widget._WidgetBase.update is called when context is changed or initialized. Implement to re-render and / or fetch data.
        update: function (obj, callback) {
            logger.debug(this.id + ".update");

            this._contextObj = obj;
			this._transactionTypeData = this._contextObj.get(this.transactionType);
            this._reqIdentifierData = this._contextObj.get(this.reqIdentifier);
			
			
			if (this.customDivID !== "") {
				this.domNode.id = this.customDivID;
			}
			
			this._paymentCenter = new this.PaymentCenterCoordinator(this._contextObj.get(this.urlParam), this.customDivID, this);
			
			
			/*
			Below are the listeners triggered from payment center to this.  
				**********Registering the Listeners***************	
			*/
			this._paymentCenter.on("load", this.stopSpinner);
			this._paymentCenter.on("eftEnrollInit", this.erieExpress);
			this._paymentCenter.on("state.first", this.downPayment);
			this._paymentCenter.on("state.final", this.transactionDetails);
			this._paymentCenter.on("completed", this.savePaymentInformation);
			this._paymentCenter.on("processingEnrollment", this.startSpinner);
			this._paymentCenter.on("processing", this.startSpinner);
			this._paymentCenter.on("stop-processing", this.stopSpinner);
			this._paymentCenter.on("eftEnrollError", this.eftErrorOccured);
			this._paymentCenter.on("state.error", this.oopsDisplayed);

			//Endorsement changes
			this._paymentCenter.on("processingEndorsementChanges", this.startSpinner);
			this._paymentCenter.on("endorsementChangesComplete", this.EndorsementChangesCompleted);

			// Hide all the buttons
			$("." + this.drgContinue).hide(); // Continue to down payment(first time)
			$("." + this.drgContinueError).hide();// Continue to down payment if there is any error while saving bank details(second time)
			$("." + this.drgSubmit).hide(); // Submit
			$("." + this.drgSubmitDown).hide(); //SUbmit down payment
			$("." + this.drgSubmitNo).hide(); //SUbmit no down payment
			$("." + this.drgContinueChange).hide(); //Endorsement Enrollment submit
			$("." + this.drgContinueChangeError).hide(); //Endorsement Enrollment submit


			//Newbusiness,rewrite display the deafult dragon action buttons.
			if (this._transactionTypeData === "9" || this._transactionTypeData === "3604") {
				logger.debug("document load - new business");
				$("." + this.drgSubmitNo).show(); //Submit no down payment  

			} else if (this._transactionTypeData === "4") {
				logger.debug("document load - endorsment");
				$("." + this.drgContinueChange).show(); //Endorsement Enrollment submit

			}
	
            callback();
        },

        // mxui.widget._WidgetBase.enable is called when the widget should enable editing. Implement to enable editing if widget is input widget.
        enable: function () {
			logger.debug(this.id + ".enable");
        },

        // mxui.widget._WidgetBase.enable is called when the widget should disable editing. Implement to disable editing if widget is input widget.
        disable: function () {
			logger.debug(this.id + ".disable");
        },

        // mxui.widget._WidgetBase.resize is called when the page's layout is recalculated. Implement to do sizing calculations. Prefer using CSS instead.
        resize: function (box) {
			logger.debug(this.id + ".resize");
        },

        // mxui.widget._WidgetBase.uninitialize is called when the widget is destroyed. Implement to do special tear-down work.
        uninitialize: function () {
			logger.debug(this.id + ".uninitialize");
            // Clean up listeners, helper objects, etc. There is no need to remove listeners added with this.connect / this.subscribe / this.own.
        },
		
		WidgetConfig: function (n) {
			var i = this,
				r = 0,
				t = document.createElement("iframe"),
				f = document.getElementById(n.id),
				u;
			i.onloadCallbacks = [];
			t.setAttribute("id", n.id + "-iframe");
			t.setAttribute("allowtransparency", "true");
			t.setAttribute("frameborder", "0");
			t.setAttribute("role", "complementary");
			t.setAttribute("width", "100%");
			t.setAttribute("scrolling", "no");
			t.setAttribute("horizontalscrolling", "no");
			t.setAttribute("verticalscrolling", "no");
			t.setAttribute("src", n.url);
			t.setAttribute("style", "width: 100% !important; border: none !important; overflow: hidden !important; position: absolute; z-index: 100");
			f.setAttribute("style", "position: relative; z-index: 90");
			f.appendChild(t);
			u = function () {
				for (r = 0; r < i.onloadCallbacks.length; r = r + 1) {
					i.onloadCallbacks[r]();
				}
			};
			t.attachEvent ? t.attachEvent("onload", u) : t.onload = u;
			i.onload = function (n) {
				i.onloadCallbacks.push(n);
			};
		},
		PaymentCenterCoordinator: function (n, t, self) {
			var i = this,
				r = [],
				u = new self.WidgetConfig({
					id: t,
					url: n
				});
			u.onload(function () {
				i.trigger("load");
			});
			i.on = function (n, t) {
				r.push({
					eventName: n,
					action: t
				});
			};
			i.trigger = function (n, t) {
				for (var u, i = 0; i < r.length; i++) u = r[i], u.eventName === n && u.action(t);
			};
		},

		/*This event will be triggered by paymencenter when ever the paymentcenrer start processing any action(like display of enrlomment screen,downpayment..etc)*/
		startSpinner: function(e) {
			logger.debug("start spinner");
			
			this._pid = mx.ui.showProgress();
			
		},

		/*This event will be triggered by paymentcenetr when ever the paymentcenrer done with processing of any action(submit enrollment enrlomment screen and downpayment..etc)*/

		stopSpinner: function(e) {
			logger.debug("stop spinner");
			
			if (this._pid !== null) {
				mx.ui.hideProgress(this._pid);
			}
		},	
		/*
		If the selected pay plan on the policy is "G"  then PC triggers this function to display "Continue" button. 
		On the click of "Continue" button CLION trigger  an event "enrollContinue" in newbusiness and in endorsment "enrollSubmit".
		*/
		erieExpress: function(e) {
			// Hide all the buttons
			logger.debug("Enroll bank details screen load ");
			$("." + this.drgSubmit).hide(); // Submit
			$("." + this.drgSubmitDown).hide(); //Submit down payment
			$("." + this.drgSubmitNo).hide(); //Submit no down payment	
			$("." + this.drgContinueError).hide(); // Continue Error
			$("." + this.drgContinueChangeError).hide(); // Change Summary Error
			//Newbusiness and rewrite
			if(this._transactionTypeData === "9" || this._transactionTypeData === "3604")
			{	
				logger.debug("Enroll bank details screen load - newbusiness ");
				$("." + this.drgContinueChange).hide(); //Endorsement Enrlomment submit
				$("." + this.drgContinue).show(); // Continue
				$("." + this.drgContinue).click(this.continueFromEnrollmentNewbusiness);

			}else if(this._transactionTypeData === "4"){	
				//Endoserments
				logger.debug("Enroll bank details screen load - endorsment ");
				$("." + this.drgContinue).hide(); // Continue
				$("." + this.drgContinueChange).show(); //Endorsement Enrlomment submit
				$("." + this.drgContinueChange).click(this.continueFromEnrollmentEndorsement);
			}
		},

		/*
		If the selected pay plan on the policy is "G" and when user clicks on "Continue" button in new business and rewrite CLION trigger  "enrollContinue" event to PC.
		*/
		continueFromEnrollmentNewbusiness: function(e) {
			logger.debug("Continue from bank enroll screen in new business ");
			this._paymentCenter.trigger("enrollContinue");
			return false; 
		},


		EndorsementChangesCompleted: function(e){
			logger.debug("Endorsment chnages are done ");

			if(e === "Success"){
			logger.debug("Endorsment chnages are done and success ");

				//compareandProcess();
				//submitForm("Action.867895", "2", "null", "");
				
				//TODO
			}
		},
		/*
		If the selected pay plan on the policy is "G" and when user clicks on "Continue" button in endorsment CLION trigger  "enrollSubmit" event to PC.
		*/
		continueFromEnrollmentEndorsement: function(e) {
			logger.debug("Continue from bank enroll screen in endorsment");
			this._paymentCenter.trigger("enrollSubmit");
			return false; 
		},
		/*
		This function is invoked on the click on "Submit Down Payment" button.
		*/	
		submitDownPayment: function(e) {     
			logger.debug("Submit downpayment");  
			this._paymentCenter.trigger("submitPayment");
			return false;
		},

		downPaymentOnEftError: function(e) {     
			logger.debug("Continue from bank enrollement when there is an error on EFT - NB");
			this._paymentCenter.trigger("enrollDownPayment");
			return false;
		},
		/*
		If the selected pay plan on the policy is other-than "G"  or when PC triggers 'State.first' error or when user clicks on "Continue" button then display "Submit Payment" button. 
		On the click of "Submit Payment" button CLION trigger  "submitDownPayment" listener to PC.
		*/	
		downPayment: function(e){
			logger.debug("down payment screen load");
			$("." + this.drgSubmit).hide(); // Submit
			$("." + this.drgContinue).hide(); //Continue
			$("." + this.drgContinueError).hide(); //Continue
			$("." + this.drgSubmitNo).hide(); //SUbmit no down payment	
			$("." + this.drgContinueChange).hide(); //Endorsement Enrlomment submit
			$("." + this.drgContinueChangeError).hide(); //Endorsement Enrlomment error submit
			$("." + this.drgSubmitDown).show(); //Submit down payment
			$("." + this.drgSubmitDown).click(this.submitDownPayment);
		},
		/*
		When payment center triggers the "state.final" listener, dragon invoke this function to continue submitting the policy.
		*/	
		transactionDetails: function(e) {
			logger.debug("trx details load");
			// Hide all the buttons except dragon submit
			$("." + this.drgContinue).hide(); // Continue
			$("." + this.drgContinueError).hide(); //Continue
			$("." + this.drgSubmitDown).hide(); //SUbmit down payment
			$("." + this.drgSubmitNo).hide(); //SUbmit no down payment	
			$("." + this.drgContinueChange).hide(); //Endorsement Enrlomment submit			
			$("." + this.drgContinueChangeError).hide(); //Endorsement Enrlomment error submit

			$("." + this.drgSubmit).show(); // Submit
		},
		/* 
		At any point in work-flow, if PC fires "'eftEnrollError" listener then dragon invokes below function.
		This error may trigger on the click of "Continue" Button or when loading the payment center  bank details screen.
		*/		
		eftErrorOccured: function(e){

			logger.debug("EFT error occured - NB or END");
			// Hide all the buttons
			$("." + this.drgSubmit).hide(); // Submit
			$("." + this.drgSubmitDown).hide(); //SUbmit down payment
			$("." + this.drgSubmitNo).hide(); //SUbmit no down payment	

			//Newbusiness and rewrite
			if(this._transactionTypeData === "9" || this._transactionTypeData === "3604"){	
				logger.debug("EFT error occured - NB");
				$("." + this.drgContinueChange).hide(); //Endorsement Enrlomment submit
				$("." + this.drgContinueChangeError).hide(); //Endorsement Enrlomment error submit
				$("." + this.drgContinue).hide(); // Continue
				$("." + this.drgContinueError).show(); // Continue

				$("." + this.drgContinueError).click(this.downPaymentOnEftError);

			}else if(this._transactionTypeData === "4"){	
				logger.debug("EFT error occured - EN");
				//Endoserments
				$("." + this.drgContinue).hide(); // Continue
				$("." + this.drgContinueError).hide(); // Continue
				$("." + this.drgContinueChange).hide(); //Endorsement Enrlomment submit

				$("." + this.drgContinueChangeError).show(); //Endorsement Enrlomment error submit

			}
		},
		/*
		When there is an error while loading downpayment screen or during payment submit the below function invloked to hide all the buttons except  Submit Without DownPayment button using which user can submit transaction without payment information
		*/
		oopsDisplayed: function(e) {
			logger.debug("downpayment error");  
			//Newbusiness and rewrite
			if(this._transactionTypeData === "9" || this._transactionTypeData === "3604"){
				$("." + this.drgContinue).hide(); // Continue
				$("." + this.drgContinueError).hide(); //Continue
				$("." + this.drgSubmitDown).hide(); //SUbmit down payment	
				$("." + this.drgContinueChange).hide(); //Endorsement Enrlomment submit
				$("." + this.drgContinueChangeError).hide(); //Endorsement Enrlomment submit Error


				if (this._reqIdentifierData === "00000000-0000-0000-0000-000000000000" ) {    
				$("." + this.drgSubmit).hide(); // Submit
				$("." + this.drgSubmitNo).show(); //SUbmit no down payment	
				} else {    

				$("." + this.drgSubmit).show(); // Submit
				$("." + this.drgSubmitNo).hide(); //SUbmit no down payment	
				}
			}else if(this._transactionTypeData === "4"){	

				$("." + this.drgContinue).hide(); // Continue
				$("." + this.drgContinueError).hide(); // Continue
				$("." + this.drgSubmit).hide(); // Submit
				$("." + this.drgSubmitDown).hide(); //SUbmit down payment	
				$("." + this.drgSubmitNo).hide(); //SUbmit no down payment
				$("." + this.drgContinueChange).hide(); //Endorsement Enrlomment submit

				$("." + this.drgContinueChangeError).show(); //Endorsement Enrlomment submit Error

			}
		}, 

		/*
		This function is invoked on the click of "Submit Down Payment" button. 
		In this function Dragon parse the response sent by PaymentCenter in JSON model and retrieve the required information from it.
		*/	

		savePaymentInformation: function(response){ 
			logger.debug("save response start");
			this.saveResponse(response);
		},


		handleResponseSaveError: function(error) {
			logger.debug("Payment information was not saved. Error: ");
		},

		responseSavedSuccessfully: function(e) {
			logger.debug("Payment information saved successfully");
		},
		/**
		* function saveResponse
		* This method is invoked to save the response to the database.
		* @param input param Response to save 
		*/
		saveResponse: function(response){
			logger.debug("save response invoke");
			//TODO
			/*
			var sessionId = document.framework.elements['DRAGON_SESSION_ID'].value;
			var transId = document.framework.elements['DRAGON_TRANSACTION_ID'].value;
			if( response != ""){  
				Ext.Ajax.request({
					url: '/ClionUtilityApps/PaymentCenterServlet',
					method: 'POST',                                            
					params: {
					DRAGON_SESSION_ID : sessionId,
					DRAGON_TRANSACTION_ID : transId,
					paymentCenterResponse : Ext.JSON.encode(response)
					},
					scope:this,
					success: function(){responseSavedSuccessfully('Success');},                                    
					failure: function(){handleResponseSaveError('failure');}
				});
			}
			*/
			return true;
		}
    });		
});

require(["EriePaymentCenter/widget/EriePaymentCenter"], function() {
    "use strict";
});
