/*
	TeaTimer: A Firefox extension that protects you from oversteeped tea.
	Copyright (C) 2008 Philipp Söhnlein

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
function teaTimerOptionsWindow()
{
    this.init=function()
    {
        document.addEventListener("keypress",teaTimerQtInstance.documentKeypress,false);
        document.getElementById("teaTimer-optionsWinBtnCancel").addEventListener("command",teaTimerOptionsWindowInstance.cancelButtonCommand,false);
        //document.getElementById("teaTimer-optionsWinBtnOk").addEventListener("command",teaTimerOptionsWindowInstance.okButtonCommand,false);
    }
    
    this.documentKeypress=function(event)
    {
        if(event.keyCode===27) //escape
        {
            window.close();
        }
    }
    
    this.cancelButtonCommand=function()
    {
        window.close();
    }
}


var teaTimerOptionsWindowInstance=new teaTimerOptionsWindow();
window.addEventListener("load",teaTimerOptionsWindowInstance.init,false);