/*
    TeaTimer: A Firefox extension that protects you from oversteeped tea.
    Copyright (C) 2008-2013 Philipp Söhnlein

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License version 3 as
    published by the Free Software Foundation.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

function teaTimer()
{
    const thisClassName="teaTimer"; // needed in debug output

    const teaDB=new teaTimerTeaDB();
    const common=new teaTimerCommon();

    var teatimerBox=null; //container for teatimer-box (box)
    var teatimerCountdownBox=null; //container for 'teatimer-countdownbox' (box; wraps teatimer-countdown)
    var teatimerCountdown=null; //container for XUL element reference  to 'teatimer-countdown' (label)
    var teatimerToolbarbutton=null; //main toolbarbutton containing the former contextmenu
    var teatimerContextMenu=document.getElementById("teatimer-contextMenu");
    var teatimerViewModeIconAndTime=null; //container for view mode icon and text menuitem
    var teatimerViewModeIconOnly=null; //container for view mode icon only menuitem
    const sound=Components.classes["@mozilla.org/sound;1"].createInstance().QueryInterface(Components.interfaces.nsISound);

    var self=this;
    var countdownInterval=null; //container for the countdown interval ressource
    var statusbarAlertInterval=null; //container for the statusbar alert ('blink-blink') interval ressource
    var startingTSofCurrentCountdown=null;
    var steepingTimeOfCurrentTea=null;
    var countdownInProgress=false; //flag
    var idOfCurrentSteepingTea=null;
    var uninstallFlag=false; //this flag is set to true, if the extension is going to be uninstalled when browser is closed
    const uninstObserver=Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);

    var appInfo = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo);
    var versionChecker = Components.classes["@mozilla.org/xpcom/version-comparator;1"].getService(Components.interfaces.nsIVersionComparator);


    /**
     * The public init method of teaTimer.
     **/
    this.init=function()
    {
        migrateOldPreferences();

        teatimerBox=document.getElementById("teatimer-box");

        teatimerCountdownBox=document.getElementById("teatimer-countdownbox");
        teatimerCountdownBox.addEventListener("click",teaTimerInstance.countdownAreaClicked,false);

        teatimerCountdown=document.getElementById("teatimer-countdown");
        teatimerToolbarbutton=teatimerBox.getElementsByTagName("toolbarbutton")[0];

        sound.init();
        document.getElementById("teatimer-options").addEventListener("command",teaTimerInstance.openOptionsWindow,false);
        document.getElementById("teatimer-quicktimer").addEventListener("command",teaTimerInstance.quicktimerMenuitemCommand,false);
        document.getElementById("teatimer-cancel").addEventListener("command",teaTimerInstance.cancelTimer,false);

        if(common.checkIfSoundAlertIsInitalized("start")===false)
        {
            common.setSound("start","eggtimer");
        }

        if(common.checkIfSoundAlertIsInitalized("end")===false)
        {
            common.setSound("end","slurp");
        }

        if(teaDB.getNumberOfTeas()===0)
        {
            teaDB.initTeaDB();
        }
        teatimerContextMenu=document.getElementById("teatimer-contextMenu");
        teatimerContextMenu.addEventListener("popupshowing",teaTimerInstance.prepareTeaSelectMenu,false);

        teatimerViewModeIconAndTime=document.getElementById("teatimer-showModeIconAndTime");
        teatimerViewModeIconOnly=document.getElementById("teatimer-showModeIconOnly");

        if(common.getViewMode()==="iconOnly")
        {
            teatimerViewModeIconAndTime.setAttribute("checked","false");
            teatimerViewModeIconOnly.setAttribute("checked","true");
        }
        else
        {
            teatimerViewModeIconAndTime.setAttribute("checked","true");
            teatimerViewModeIconOnly.setAttribute("checked","false");
        }

        renderViewMode();
        teatimerViewModeIconAndTime.addEventListener("command",teaTimerInstance.viewModeChanged,false);
        teatimerViewModeIconOnly.addEventListener("command",teaTimerInstance.viewModeChanged,false);

        resetCountdown();

        uninstObserver.addObserver(self,"em-action-requested",false);
        uninstObserver.addObserver(self,"quit-application-granted",false);

    }

    /*
        ==============
        | UI methods |
        ==============
    */

    /**
     * This public method can be called to regenerate/update the teas in tea timer context menu, based on the current content of the database.
     * It adds the tea nodes before the separator with XUL ID teatimer-endTealistSeparator
     **/
    this.prepareTeaSelectMenu=function()
    {
        var teas=teaDB.getDataOfAllTeas(false,common.getSortingOrder());

        var startSeparator=document.getElementById("teatimer-endViewModeSeparator");
        var endSeparator=document.getElementById("teatimer-endTealistSeparator");
        var i=0;
        while(endSeparator.previousSibling)
        {
            if(endSeparator.previousSibling==startSeparator || i>100) //i>100=endless loop prevention
            {
                break;
            }
            endSeparator.parentNode.removeChild(endSeparator.previousSibling);

            i++;
        }

        for(i=0; i<teas.length; i++)
        {
            var tea=teas[i];
            var teaNode=document.createElement("menuitem");
            teaNode.setAttribute("name","teatimer-tea");
            teaNode.setAttribute("value",tea["ID"]);
            teaNode.setAttribute("label",tea["name"]+" ("+common.getTimeStringFromTime(tea["time"])+")");
            teaNode.setAttribute("type","radio");
            if(tea["choosen"]===true)
            {
                teaNode.setAttribute("checked","true");
            }

            teaNode.addEventListener("command",function(){teaTimerInstance.teaChoosen(parseInt(this.getAttribute("value")));},false); //extract the numeric ID from the menuitem ID which should be something like 'teatimer-tea1"

            teatimerContextMenu.insertBefore(teaNode,endSeparator);
        }
    }

    /**
     * This event method is called, when a tea was choosen from the tea context menu.
     * It stops a maybe running countdown, markes the given tea as checked in the database and starts the new countdon.
     *
     * @param integer teaID
     * @throws teaTimerInvalidTeaIDException
     **/
    this.teaChoosen=function(id)
    {
        id=parseInt(id);
        if(isNaN(id) || !teaDB.checkTeaWithID(id))
        {
            throw new teaTimerInvalidTeaIDException("teaChoosen: Invalid tea ID given.");
        }

        self.stopCountdown();

        teaDB.setTeaChecked(id);
        idOfCurrentSteepingTea=null; //reseting maybe set quicktimer flag

        self.setCountdown(teaDB.getTeaData(id)["time"]);
        self.startCountdown();
    }

    /**
     * This method is called, when the quick timer menu item is acivated (clicked).
     * It opens the quicktimer window.
     **/
    this.quicktimerMenuitemCommand=function()
    {
        window.openDialog("chrome://teatimer/content/quicktimer.xul","","centerscreen,dialog,modal,resizable,scrollbars,dependent");
    }

    /**
     * This method is called, when the options menu item is acivated (clicked).
     * It opens the options window.
     **/
    this.openOptionsWindow=function()
    {
        window.openDialog("chrome://teatimer/content/options.xul","","centerscreen,dialog,modal,resizable,scrollbars,dependent");
    }

    /**
     * This public method is called when the user clicks in the teaTimer statusbar panel.
     * @param object mouseEvent
     **/
    this.countdownAreaClicked=function(mouseEvent)
    {
        if(mouseEvent.button===0) //left click
        {
            if(countdownInProgress===true)
            {
                //timer pausing code was here
            }
            else
            {
                self.startCountdown();
            }
        }
    }

    /**
     * This public method is called, when the view mode is changed from icon only mode to icon and text mode or vice versa
     **/
    this.viewModeChanged=function()
    {
        var viewMode=(teatimerViewModeIconAndTime.getAttribute("checked"))?"timeAndIcon":"iconOnly";
        common.setViewMode(viewMode);
        renderViewMode();
    }

    /**
     * This method changes the UI according to the current set view mode.
     **/
    var renderViewMode=function()
    {
        if(teatimerViewModeIconAndTime.getAttribute("checked")==="true")
        {
            common.removeCSSClass(teatimerBox,"iconOnlyView");
        }
        else
        {
            common.addCSSClass(teatimerBox,"iconOnlyView");
        }
    }


    /*
        =================
        | Timer methods |
        =================
    */

    /**
     * This public method can be used to set a countdown.
     * @param integer time in seconds
     **/
    this.setCountdown=function(time)
    {
        time=parseInt(time);
        if(isNaN(time))
        {
            throw new teaTimerInvalidTimeException("setCountdown: Invalid call. First parameter must be an integer.");
        }

        teatimerCountdown.setAttribute("value",common.getTimeStringFromTime(time));
    }

    /**
     * This public method starts the countdown for the currently choosen tea.
     **/
    this.startCountdown=function()
    {
        self.cancelStatusbarAlert(); //maybe the statusbar alert ('blink-blink') is still on, so we have to cancel it
        countdownInProgress=true;
        if(idOfCurrentSteepingTea==="quicktimer")
        {
            steepingTimeOfCurrentTea=getCurrentCountdownTime();
        }
        else
        {
            idOfCurrentSteepingTea=teaDB.getIdOfCurrentTea();
            steepingTimeOfCurrentTea=teaDB.getSteepingTimeOfCurrentTea();
        }
        var tooltipText=common.getStringf("teatimer.currentlySteeping",new Array(common.getTimeStringFromTime(steepingTimeOfCurrentTea)));
        teatimerCountdownBox.setAttribute("tooltiptext",tooltipText);
        teatimerToolbarbutton.setAttribute("image","chrome://teatimer/skin/icon-steeping.png");

        startingTSofCurrentCountdown=new Date().getTime();

        countdownInterval=window.setInterval(teaTimerInstance.pulse,1000);

        var soundID=common.getIdOfStartSound();
        if(soundID!=="none")
        {
            if (soundID === 'systembeep') {
                sound.beep();
            }
            else {
                try {
                    sound.play(common.getURLtoSound("start",soundID,true));
                }
                catch(e) {
                    common.log("Main class","Error while playing sound. Message was " + e + "\n");
                }
            }
        }
    }

    /**
     * Use this public mehtod to cancel a currently running timer.
     **/
    this.cancelTimer=function()
    {
        if(countdownInProgress)
        {
            self.stopCountdown();
        }

        self.cancelStatusbarAlert(); //maybe the statusbar alert ('blink-blink') is still on, so we have to cancel it

        resetCountdown();
    }

    /**
     * This public method sets the quick timer mode to on and must be called when a quick timer countdown was called.
     **/
    this.setQuickTimerMode=function()
    {
        idOfCurrentSteepingTea="quicktimer";
    }

    /**
     * This public method reloads the countdown in the statusbar.
     * Included is a complete re-establishment of all events and styles of the countdownArea.
     *
     * @param boolean resetCountdown time, too?
     **/
    this.reloadCountdown=function(reset)
    {
        reset=(reset===false)?false:true;
        self.cancelStatusbarAlert(); //maybe the statusbar alert ('blink-blink') is still on, so we have to cancel it
        common.removeCSSClass(teatimerBox,"finished");
        if(reset)
        {
            resetCountdown();
        }
        teatimerCountdownBox.removeEventListener("click",teaTimerInstance.reloadCountdown,false);
        teatimerCountdownBox.addEventListener("click",teaTimerInstance.countdownAreaClicked,false);
    }

    /**
     * This public method should be called every time, when the countdown 'beats' and does everything, that should be done in every interval cycle
     **/
    this.pulse=function()
    {
        var currentTime=getCurrentCountdownTime();
        common.log("Main class","statusbartime: "+currentTime+"\n");
        var difference=new Date().getTime()-startingTSofCurrentCountdown;
        common.log("Main class","difference: "+difference+"\n");
        if((difference%1000)>=900 && (difference%1000)<1000)
        {
            difference+=100;
        }
        common.log("Main class","corrected difference: "+difference+"\n");
        common.log("Main class","steeping time of current tea: "+currentTime+"\n");
        currentTime=steepingTimeOfCurrentTea-parseInt(difference/1000);
        common.log("Main class","new statusbartime: "+currentTime+"\n\n");
        var tooltipText=common.getStringf("teatimer.currentlySteeping",new Array(common.getTimeStringFromTime(currentTime)));
        teatimerCountdownBox.setAttribute("tooltiptext",tooltipText);
        self.setCountdown(currentTime);
        if(currentTime<=0)
        {
            brewingComplete();
        }
        common.log("Main class","-----\n");
    }

    /**
     * This public method stops the current count down.
     * Please note, that it does no reset of it, so you may call resetCountdown after calling this method.
     **/
    this.stopCountdown=function()
    {
        window.clearInterval(countdownInterval);
        startingTSofCurrentCountdown=steepingTimeOfCurrentTea=null;
        countdownInProgress=false;
        teatimerToolbarbutton.setAttribute("image", "chrome://teatimer/skin/icon-inactive.png");
        teatimerCountdownBox.addEventListener("click",teaTimerInstance.countdownAreaClicked,false);
    }

    /**
     * This method is called, when the countdown is done.
     * It stops the countdown, raises the alerts and handles events for the countdown area.
     **/
    var brewingComplete=function()
    {
        self.stopCountdown();
        teatimerCountdown.setAttribute("value",common.getString("teatimer.teaReady"));
        common.addCSSClass(teatimerBox,"finished");
        teatimerCountdownBox.setAttribute("tooltiptext", common.getString("teatimer.teaReadyAndReload"));
        shootAlerts();
        idOfCurrentSteepingTea=startingTSofCurrentCountdown=steepingTimeOfCurrentTea=null;
        if(common.isAlertDesired("statusbar")===false && common.getViewMode()==="iconOnly")
        {
            self.reloadCountdown();
        }
        else
        {
            teatimerCountdownBox.removeEventListener("click",teaTimerInstance.countdownAreaClicked,false);
            teatimerCountdownBox.addEventListener("dblclick",teaTimerInstance.stopCountdown,false); //special treament of double clicks, otherwise the next countdown would be started immediately, because the normal click event will be raised to. We don't want that. That's why we stop the countdown right after that.
            teatimerCountdownBox.addEventListener("click",teaTimerInstance.reloadCountdown,false);
        }
    }

    /**
     * @returns integer the currentdown time in seconds
     **/
    var getCurrentCountdownTime=function()
    {
        return common.getTimeFromTimeString(teatimerCountdown.getAttribute("value"));
    }


    /**
     * This private method resets the countdown to the value of the currently choosen tea.
     **/
    var resetCountdown=function()
    {
        teatimerCountdownBox.setAttribute("tooltiptext", common.getString("teatimer.clickHereToStart"));
        self.setCountdown(teaDB.getSteepingTimeOfCurrentTea());
    }





    /*
        =================
        | Alert methods |
        =================
    */


    /**
     * This method fires all alerts.
     **/
    var shootAlerts=function()
    {
        doSoundAlert();

        if(common.isAlertDesired("statusbar"))
        {
            doStatusbarAlert();
        }

        if(common.isAlertDesired("widget"))
        {
            try
            {
                doWidgetAlert();
            }
            catch(e)
            {
                //if websiteWidgetAlert fails and no other alert is active, do anyhow a popupalert. It's better than having no alert at all.
                if(!common.isAlertDesired("statusbar") && !common.isAlertDesired("popup") && common.getIdOfEndSound()==="none")
                {
                    doPopupAlert(true);
                }
            }
        }

        if(common.isAlertDesired("popup"))
        {
            doPopupAlert();
        }
    }

    /**
     * This method generates and fires the 'tea-ready'-popup.
     **/
    var doPopupAlert=function(callBecauseOfWidgetError)
    {
        callBecauseOfWidgetError=((callBecauseOfWidgetError===true)?true:false);
        var teaName=null;
        if(idOfCurrentSteepingTea==="quicktimer")
        {
            teaName=common.getString("teatimer.readyMessageTeaNameQuickTimer");
        }
        else
        {
            teaName=teaDB.getTeaData(idOfCurrentSteepingTea)["name"];
        }
        window.openDialog("chrome://teatimer/content/teaReadyDialog.xul","","centerscreen,dialog,resizable,dependent,minimizable=no",teaName,callBecauseOfWidgetError);
    }

    /**
     * This method generates and fires the 'tea-ready'-statusbar-alert.
     **/
    var doStatusbarAlert=function()
    {
        teatimerCountdownBox.setAttribute("tooltiptext", common.getString("teatimer.teaReadyAndCancelAlert"));

        common.addCSSClass(teatimerBox,"readyAlert");
        statusbarAlertInterval=window.setInterval(teaTimerInstance.toggleStatusbarAlertStyle,400);
        if(common.getViewMode()==='iconOnly') {
            teatimerToolbarbutton.addEventListener('click', self.cancelStatusbarAlert, false);
        }
    }

    /**
     * This private method plays the "timer finished" sound, if there was one choosen in the options
     **/
    var doSoundAlert=function()
    {
        var soundID=common.getIdOfEndSound();
        if(soundID!=="none")
        {
            if (soundID === "systembeep") {
                sound.beep();
            }
            else {
                // try sound from options first...
                try {
                    sound.play(common.getURLtoSound("end",soundID,true));
                }
                catch(e) {
                    // if that fails, try a simple system beep
                    try {
                        sound.beep();
                        common.log("Main class","Error while playing sound. Falling back to system beep. Message was " + e + "\n");
                    }
                    catch(e) {
                        // if that fails too, give up, but don't throw an exception
                        common.log("Main class","Error while playing sound, no fallback possible. Message was " + e + "\n");
                    }
                }
            }
        }
    }

    /**
     * This private method generates the widget for the widget alert and places it in the document.
     **/
    var doWidgetAlert=function()
    {
        try
        {
            var req=new XMLHttpRequest();
            req.open("GET","chrome://teatimer/skin/widgetAlert/default/widget.html",false);
            req.overrideMimeType("text/xml");
            req.send(null);
            if(req.status===0) //status for local requests must be 0, to be okay.
            {
                var wdoc=req.responseXML;
                var widget=wdoc.getElementById("teaTimer-alertWidget");
                var targetWindow=gBrowser.selectedBrowser.contentWindow;
                var targetDoc=gBrowser.selectedBrowser.contentDocument;
                var targetBody=getWebsiteWidgetTargetDoc();

                //check if there's already an element with the ID "teaTimer-alertWidget"
                if(targetDoc.getElementById("teaTimer-alertWidget")!==null)
                {
                    //throw new teaTimerAlertWidgetAlreadyInDocumentException("Can't do widget alert, because there's already an element with the ID teaTimer-alertWidget in the document.");
                    self.removeWidgetAlert();
                }

                var teaName=null;
                if(idOfCurrentSteepingTea==="quicktimer")
                {
                    teaName=common.getString("teatimer.readyMessageTeaNameQuickTimer");
                }
                else
                {
                    teaName=teaDB.getTeaData(idOfCurrentSteepingTea)["name"];
                }

                var str=common.getStringf("teatimer.widgetAlert.enjoyYourTeaName",new Array("{TEANAME}"));
                var strPrefix=str.substr(0,str.indexOf("{TEANAME}"));
                var strPostfix=str.substr(str.indexOf("{TEANAME}")+9);

                wdoc.getElementById("teaTimer-alertWidgetHeadline").appendChild(wdoc.createTextNode(common.getString("teatimer.widgetAlert.headline")));
                wdoc.getElementById("teaTimer-alertWidgetCompleteMessage").appendChild(wdoc.createTextNode(common.getString("teatimer.widgetAlert.steepingComplete")));

                var elementTargetMap=[
                        {"source":strPrefix,"target":"teaTimer-alertWidgetEnjoyMessagePrefix"},
                        {"source":teaName,"target":"teaTimer-alertWidgetTeaName"},
                        {"source":strPostfix,"target":"teaTimer-alertWidgetEnjoyMessagePostfix"}
                ]

                for(var i=0;i<elementTargetMap.length;i++)
                {
                    var text=elementTargetMap[i].source;
                    var target=elementTargetMap[i].target;
                    if(text.indexOf("\n")>=0)
                    {
                        if(text.indexOf("\n")===0)
                        {
                            wdoc.getElementById(target).appendChild(targetDoc.createElement("br"));
                        }

                        var parts=text.split("\n");
                        for(var p=0; p<parts.length;p++)
                        {
                            wdoc.getElementById(target).appendChild(wdoc.createTextNode(parts[p]));
                            wdoc.getElementById(target).appendChild(targetDoc.createElement("br"));
                        }
                    }
                    else
                    {
                        wdoc.getElementById(target).appendChild(wdoc.createTextNode(text));
                    }
                }

                widget.addEventListener("click",teaTimerInstance.removeWidgetAlert,false);
                targetBody.appendChild(widget);

                targetBody.parentNode.getElementsByTagName("head")[0].appendChild(generateWebsiteWidgetCSSLink("reset",targetDoc));
                targetBody.parentNode.getElementsByTagName("head")[0].appendChild(generateWebsiteWidgetCSSLink("theme",targetDoc));

                var secondsUntilFadeOut=common.getWidgetAlertShowTime();
                if(secondsUntilFadeOut>0)
                {
                    targetWindow.setTimeout(teaTimerInstance.fadeOutWidgetAlert,secondsUntilFadeOut*1000);
                }
            }
        }
        catch(e)
        {
            throw e;
        }
    }

    /**
     * This method detects the correct body element of the given document. If the document contains a frameset it will return the body element of the biggest frame.
     *
     * @param object targetDoc (object HTMLDocument)
     * @returns object targetBody (object HTMLBodyElement)
     **/
    var getWebsiteWidgetTargetDoc=function(doc)
    {
        if(doc===undefined)
        {
            doc=gBrowser.selectedBrowser.contentDocument;
        }

        var targetBody=null;
        //check if website uses frames. If yes, try to findest the biggest frame, we will include the widget in it.
        if(doc.getElementsByTagName("frameset").length>0)
        {
            var frames=doc.getElementsByTagName("frameset")[0].getElementsByTagName("frame");
            var biggestFrame=null;
            var biggestFrameSize=null;
            for(var i=0; i<frames.length; i++)
            {
                var currentFrameSize=frames[i].offsetWidth*frames[i].offsetHeight;
                if(currentFrameSize>biggestFrameSize)
                {
                    biggestFrame=i;
                    biggestFrameSize=currentFrameSize;
                }
            }

            targetBody=getWebsiteWidgetTargetDoc(frames[biggestFrame].contentDocument);
        }
        else
        {
            targetBody=doc.getElementsByTagName("body")[0];
        }

        return targetBody;
    }

    /**
     * This method generates a link element that links the website widget reset or theme CSS, depending on type parameter.
     *
     * @param string type ("reset" or "theme")
     * @param object root HTMLDocument element of the link node, that has to be created.
     * @returns object Link DOM Node
     **/
    var generateWebsiteWidgetCSSLink=function(type,targetDoc)
    {
        type=((type==="reset")?"reset":"theme");

        var cssLink=targetDoc.createElement("link");
        cssLink.setAttribute("id","teaTimer-alertWidget"+((type==="reset")?"Reset":"Theme")+"CSS");
        cssLink.setAttribute("href","chrome://teatimer/skin/widgetAlert/"+((type==="reset")?"reset":"default/widget")+".css");
        cssLink.setAttribute("media","all");
        cssLink.setAttribute("rel","stylesheet");
        cssLink.setAttribute("type","text/css");

        return cssLink;
    }

    /**
     * Once called, this public method decreases the opacity of the teaTimer-alertWidget, until the opacity is 0. Finally it removes the widget.
     **/
    this.fadeOutWidgetAlert=function()
    {
        var targetWindow=gBrowser.selectedBrowser.contentWindow;
        var targetBody=getWebsiteWidgetTargetDoc();
        var targetDoc=targetBody.ownerDocument;

        var widget=targetDoc.getElementById("teaTimer-alertWidget");
        if(widget!==null)
        {
            var step=0.2;
            if(widget.style.opacity==="")
            {
                widget.style.opacity=1;
            }

            if(((widget.style.opacity*1)-step)>0)
            {
                widget.style.opacity=((widget.style.opacity*1)-step)+"";
                targetWindow.setTimeout(teaTimerInstance.fadeOutWidgetAlert,80);
            }
            else
            {
                self.removeWidgetAlert();
            }
        }
    }

    /**
     * This public method removes all HTML nodes from the document, that are associated with the teaTimer alert widget.
     * Currently these are:
     * - link node with ID 'teaTimer-alertWidgetResetCSS'
     * - link node with ID 'teaTimer-alertWidgetThemeCSS'
     * - div node with ID 'teaTimer-alertWidget'
     **/
    this.removeWidgetAlert=function()
    {
        var targetBody=getWebsiteWidgetTargetDoc();
        var targetDoc=targetBody.ownerDocument;
        var nodesToRemove=new Array("teaTimer-alertWidget","teaTimer-alertWidgetResetCSS","teaTimer-alertWidgetThemeCSS");
        for(var i=0; i<nodesToRemove.length; i++)
        {
            var node=targetDoc.getElementById(nodesToRemove[i]);
            if(node!==null)
            {
                node.parentNode.removeChild(node);
            }
        }
    }


    /**
     * This method is capable for toggling the correct CSS classes for the 'blinking'-statusbar-alert.
     **/
    this.toggleStatusbarAlertStyle=function()
    {
        if(common.getViewMode()==="iconOnly")
        {
            var image="chrome://teatimer/skin/icon-steeping.png";
            if (teatimerToolbarbutton.getAttribute("image").indexOf('steeping')>-1)
            {
                image="chrome://teatimer/skin/icon-inactive.png";
            }
            teatimerToolbarbutton.setAttribute("image",image);
        }
        else
        {
            if(teatimerBox.getAttribute("class").indexOf("invisible")>-1)
            {
                common.removeCSSClass(teatimerBox,"invisible");
            }
            else
            {
                common.addCSSClass(teatimerBox,"readyAlert");
                common.addCSSClass(teatimerBox,"invisible");
            }
        }
    }

    /**
     * This method quits the statusbar alert.
     **/
    this.cancelStatusbarAlert=function()
    {
        window.clearInterval(statusbarAlertInterval);
        common.removeCSSClass(teatimerBox,"readyAlert");
        common.removeCSSClass(teatimerBox,"invisible");
        common.removeCSSClass(teatimerBox,"finished");
        teatimerCountdownBox.removeEventListener("click",teaTimerInstance.reloadCountdown,false);
    }

    /**
     * This method was written to migrate preferences stored in "teatimer."-branch to "extensions.teatimer"-branch.
     *
     * All preferences, except the teaDB, are migrated without special treatment.
     * The teaDB migration is special: We can't use the teaDB class, so we have to poll for teas with a certain id. This happens in a loop with a special offset.
     * If there's any problem, the whole teaDB migration proccess will be restarted up to three times.
     **/
    var migrateOldPreferences=function()
    {
        const storedPreferences=Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
        const oldBranch=storedPreferences.getBranch("teatimer.");
        const newBranch=storedPreferences.getBranch("extensions.teatimer.");

        var childListOfOldBranch=new Object();
        oldBranch.getChildList("",childListOfOldBranch);
        if(childListOfOldBranch.value>0)
        {
            //migrate alert preferences
            var prefs2Migrate= [
                {"pref":"alerts.doPopupAlert","type":"bool"},
                {"pref":"alerts.doStatusbarAlert","type":"bool"},
                {"pref":"alerts.doWidgetAlert","type":"bool"},
                {"pref":"alerts.endSound","type":"string"},
                {"pref":"alerts.startSound","type":"string"},
                {"pref":"alerts.widgetAlertShowTime","type":"integer"}
            ]

            for(var i=0; i<prefs2Migrate.length; i++)
            {
                try
                {
                    var value=null;
                    switch(prefs2Migrate[i]["type"])
                    {
                        case "bool":
                            try { value=oldBranch.getBoolPref(prefs2Migrate[i]["pref"]); } catch(e) {}
                            if(typeof value==="boolean") { newBranch.setBoolPref(prefs2Migrate[i]["pref"],value); }
                            break;
                        case "integer":
                            try { value=oldBranch.getIntPref(prefs2Migrate[i]["pref"]); } catch(e) {}
                            if(typeof value==="number") { newBranch.setIntPref(prefs2Migrate[i]["pref"],value); }
                            break;
                        case "string":
                            try { value=oldBranch.getCharPref(prefs2Migrate[i]["pref"]); } catch(e) {}
                            if(typeof value==="string") { newBranch.setCharPref(prefs2Migrate[i]["pref"],value); }
                            break;
                    }
                }
                catch(e)
                {
                    //dump("\n\n-----------\n"+i+" "+prefs2Migrate[i]["type"]+" "+prefs2Migrate[i]["pref"]+" "+value+"\n")
                    //dump(e);
                    common.log("Main class","Error while migrating pref '"+prefs2Migrate[i]["pref"]+"' into new branch.\n");
                }
            }

            //migrate teas
            const offset=23;
            var end=offset;

            var tries=3;
            for(var t=0; t<tries; t++)
            {
                var retry=false;

                for(var i=1; i<end; i++)
                {
                    var teaExists=false;

                    try
                    {
                        newBranch.setCharPref("teas."+i+".name",oldBranch.getCharPref("teas."+i+".name"));
                        teaExists=true;
                    }
                    catch(e)
                    { /* do nothing, it just means, that there was no tea with the ID i */ }

                    if(teaExists)
                    {
                        var teaTimeValue=1; //fallback value; 1 second is not very useful, but the user will definitely recognize that he/she has to edit the tea steeping time.
                        var teaCheckedValue=false; //fallback value;
                        var teaHiddenValue=false; //fallback value;
                        try { teaTimeValue=oldBranch.getIntPref("teas."+i+".time"); } catch (e) { retry=true; }
                        try { teaCheckedValue=oldBranch.getBoolPref("teas."+i+".checked"); } catch (e) { retry=true;}
                        try { teaHiddenValue=oldBranch.getBoolPref("teas."+i+".hidden"); } catch (e) { retry=true; }

                        try { newBranch.setIntPref("teas."+i+".time",teaTimeValue); } catch (e) { retry=true; }
                        try { newBranch.setBoolPref("teas."+i+".checked",teaCheckedValue); } catch (e) { retry=true; }
                        try { newBranch.setBoolPref("teas."+i+".hidden",teaHiddenValue); } catch (e) { retry=true; }

                        end=i+offset;
                    }
                }

                if(!retry)
                {
                    break; //everything was okay.
                }
            }

            storedPreferences.getBranch("").deleteBranch("teatimer.");
        }
    }

    /*
        ==================================
        | Uninstall and clean up methods |
        ==================================

        A observer is used to get notified, when the extension is marked for uninstalling.
    */


    /**
     * This public method will be called every time when a action occurred in the extension/addon-manager.
     * It then detects, if the called action is to uninstall this extension and sets a flag.
     * This method will also be called when the browser is closed and if the flag is set, it does some uninstalling-/cleaning-actions.
     *
     * @param object xpconnect
     * @param string requested action ID
     * @param string requested action value
     * @returns bool true, if everything was okay
     **/
    this.observe=function(subject,actionID,actionValue)
    {
        if(actionID==="em-action-requested")
        {
            subject.QueryInterface(Components.interfaces.nsIUpdateItem);
            if(subject.id==="teatimer@codepaintedby.philipp-soehnlein.de")
            {
                if(actionValue==="item-uninstalled")
                {
                    uninstallFlag=true;
                }
                else if(actionValue==="item-cancel-action")
                {
                    uninstallFlag=false;
                }
            }
        }
        else if(actionID==="quit-application-granted")
        {
            if(uninstallFlag)
            {
                uninstall();
            }
            uninstObserver.removeObserver(self,"em-action-requested");
            uninstObserver.removeObserver(self,"quit-application-granted");
        }

        return true;
    }

    /**
     * This private method does some cleaning, when the extension is uninstalled.
     **/
    var uninstall=function()
    {
        const storedPrefs=Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
        storedPrefs.deleteBranch("extensions.teatimer.");
    }
}

function teaTimerAlertWidgetAlreadyInDocumentException(msg)
{
    this.name="teaTimerAlertWidgetAlreadyInDocumentException";
    this.message=((msg===undefined)?null:msg);
}

var teaTimerInstance=new teaTimer();
window.addEventListener("load",teaTimerInstance.init,false);
