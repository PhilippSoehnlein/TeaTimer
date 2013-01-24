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
function teaTimerQuickTimer()
{
    const common=new teaTimerCommon();

    this.init=function()
    {
        document.getElementById("teaTimer-qtTime").focus();
        document.addEventListener("keypress",teaTimerQtInstance.documentKeypress,false);
		document.getElementById("teaTimer-qtTime").addEventListener("keypress",teaTimerQtInstance.timeKeypress,false);
        document.getElementById("teaTimer-qtBtnCancel").addEventListener("command",teaTimerQtInstance.cancelButtonCommand,false);
        document.getElementById("teaTimer-qtBtnOk").addEventListener("command",teaTimerQtInstance.okButtonCommand,false);
    }

    this.documentKeypress=function(event)
    {
        if(event.keyCode===27) //escape
        {
            window.close();
        }
    }

    this.timeKeypress=function(event)
    {
	if(event.keyCode===13) //enter
        {
            handleTimeInput();
        }
    }

    this.okButtonCommand=function()
    {
        handleTimeInput();
    }

    var handleTimeInput=function()
    {
	var ok=false;
        var input=document.getElementById("teaTimer-qtTime").value;

	try
	{
            var time=common.validateEnteredTime(input);
            ok=true;
            window.opener.teaTimerInstance.stopCountdown();
            window.opener.teaTimerInstance.reloadCountdown();
            window.opener.teaTimerInstance.setCountdown(time);
            window.opener.teaTimerInstance.setQuickTimerMode();
			if(document.getElementById("teaTimer-qtChkStartCountdown").checked)
            {
                window.opener.teaTimerInstance.startCountdown();
            }
            window.opener.teaTimerInstance.setQuickTimerMode();
        }
        catch(e)
        {
            var errorMsg="";
            if(e.name==="teaTimerTimeInputToShortException")
            {
                errorMsg=common.getString("quicktimer.validate.timeInputToShort");
            }
            else
            {
                errorMsg=common.getString("quicktimer.validate.timeInputInWrongFormat");
            }

            errorMsg+="\n"+common.getString("quicktimer.validate.timeInputAdvice");
            alert(errorMsg);
        }

	if(ok)
	{
	    window.close();
	}
    }

    this.cancelButtonCommand=function()
    {
        window.close();
    }
}




var teaTimerQtInstance=new teaTimerQuickTimer();
window.addEventListener("load",teaTimerQtInstance.init,false);
