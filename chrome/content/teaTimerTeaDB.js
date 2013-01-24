/*
	TeaTimer: A Firefox extension that protects you from oversteeped tea.
	Copyright (C) 2008-2013 Philipp Söhnlein

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License version 3 as
	published by the Free Software Foundation.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
	GNU General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

function teaTimerTeaDB()
{
    var self=this;

    const common=new teaTimerCommon();

    const storedPrefs=Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
    const teaDB=storedPrefs.getBranch("extensions.teatimer.teas.");

    /**
     * This method generates a basic preconfigured tea database.
     **/
    this.initTeaDB=function()
    {
	common.log("teaTimer","Initiating Tea Database\n");
	teaDB.setCharPref("1.name","Earl Grey");
	teaDB.setIntPref("1.time",180);
	teaDB.setBoolPref("1.checked",true);
	teaDB.setBoolPref("1.hidden",false);

	teaDB.setCharPref("2.name","Rooibos");
	teaDB.setIntPref("2.time",420);
	teaDB.setBoolPref("2.checked",false);
	teaDB.setBoolPref("2.hidden",false);

	teaDB.setCharPref("3.name","White Tea");
	teaDB.setIntPref("3.time",120);
	teaDB.setBoolPref("3.checked",false);
	teaDB.setBoolPref("3.hidden",false);
    }

    /**
     * This method counts the number of available teas in the database.
     * @returns integer number of teas
     **/
    this.getNumberOfTeas=function()
    {
		var teas=0;
        const offset=23;
        var end=offset;
		for(var i=1; i<=end; i++)
		{
		    try
		    {
				if(self.checkTeaWithID(i))
				{
				    teas++;
                    end=i+offset;
				}
		    }
		    catch(ex)
		    {
				//do nothing
		    }
		}

		return teas;
    }

    /**
     * This private method checks if a certain tea is marked for deletion (hidden).
     * @param integer teaID
     * @return bool hidden oder not?
     * @throws teaTimerInvalidTeaIDException
     **/
    var checkIfTeaIsHidden=function(id)
    {
		if(checkTeaWithID(id)===false)
		{
			throw new teaTimerInvalidTeaIDException("checkIfTeaIsHidden: Invalid call, first parameter must be a tea ID.");
		}

		return ((getTeaData(id)["hidden"]===true)?true:false);
    }

    /**
     * This public method adds a tea to the DB.
     * @param string teaName
     * @param integer teaTime (in seconds)
     * @param boolean mark tea as active tea?
     * @returns integer new teaID
     * @throws teaTimerDBInsufficientInputDataException
     **/
    this.addTea=function(name,time,checked)
    {
        if(!(
            typeof name==="string" && name.length>0 &&
            typeof time==="number" && parseInt(time,10)>0
            )
        )
        {
            throw new teaTimerDBInsufficientInputDataException("addTea: First parameter must be a string with more than 0 chars, second parameter must be a vaild time integer.");
        }

		time=parseInt(time,10);
        checked=(checked===true)?true:false;

        var id=getNextAutoIncrementId();
        teaDB.setCharPref(id+".name",name);
		teaDB.setIntPref(id+".time",time);
		teaDB.setBoolPref(id+".checked",checked);
		teaDB.setBoolPref(id+".hidden",false);

        if(checked===true)
        {
            self.setTeaChecked(id); //we should call this, to make sure, that no other tea is marked as active.
        }

        return id;
    }

    /**
     * This private method calculates the next free ID.
     * @returns integer ID
     **/
    var getNextAutoIncrementId=function()
    {
        var allTeaIDs=self.getIDsOfTeas();
        return allTeaIDs[allTeaIDs.length-1]+1;
    }

    /**
     * This public method lets you set the name of a certain existing tea.
     * @param integer teaID
     * @param string newName
     * @throws teaTimerInvalidTeaIDException
     * @throws teaTimerInvalidTeaNameException
     **/
    this.setName=function(id,name)
    {
        if(self.checkTeaWithID(id)===false)
        {
            throw new teaTimerInvalidTeaIDException("setName: Invalid call, first parameter must be a tea ID.");
        }

        if(!(typeof name==="string" && name.length>0))
        {
            throw new teaTimerInvalidTeaNameException("setName: Invalid call, second parameter must be a valid name.");
        }

        teaDB.setCharPref(id+".name",name);
    }

    /**
     * This public method lets you set the time of a certain existing tea.
     * @param integer teaID
     * @param integer new time (in seconds)
     * @throws teaTimerInvalidTeaIDException
     * @throws teaTimerInvalidTeaTimeException
     **/
    this.setTime=function(id,time)
    {
        if(self.checkTeaWithID(id)===false)
        {
            throw new teaTimerInvalidTeaIDException("setTime: Invalid call, first parameter must be a tea ID.");
        }

        if(!(typeof time==="number" && parseInt(time,10)>0))
        {
            throw new teaTimerInvalidTeaTimeException("setTime: Invalid call, second parameter must be a time integer greater than 0.");
        }

        teaDB.setIntPref(id+".time",parseInt(time,10));
    }

     /**
     * This public method sets a certain existing tea for deletion (hidden).
     * @param integer teaID
     * @throws teaTimerInvalidTeaIDException
     **/
    this.setHidden=function(id)
    {
	if(self.checkTeaWithID(id)===false)
        {
            throw new teaTimerInvalidTeaIDException("setHidden: Invalid call, first parameter must be a tea ID.");
        }

        teaDB.setBoolPref(id+".hidden",true);
    }

    /**
     * This public method finally deletes a certain tea.
     * It does not check, if the tea was marked as "hidden" before!
     * @param integer teaID
     * @throws teaTimerInvalidTeaIDException
     **/
    this.deleteTea=function(id)
    {
        if(self.checkTeaWithID(id)===false)
        {
            throw new teaTimerInvalidTeaIDException("setTime: Invalid call, first parameter must be a tea ID.");
        }

        teaDB.clearUserPref(id+".name");
        teaDB.clearUserPref(id+".time");
        teaDB.clearUserPref(id+".checked");
		teaDB.clearUserPref(id+".hidden");
    }

    /**
     * You can use this method to check if there's a tea with a certain ID.
     *
     * @param integer TeaID2check
     * @returns boolean true or false
     **/
    this.checkTeaWithID=function(id)
    {
		var result=false;
		try
		{
			if(
				teaDB.getCharPref(id+".name").length>0 &&
				teaDB.getIntPref(id+".time")>0 &&
				typeof teaDB.getBoolPref(id+".checked")==="boolean"
			)
			{
				result=true;
		    }
		}
		catch(e)
		{

		}

		return result;
    }

    /**
     * This method queries the database and returns an arary with the ID, the name, the time and the 'choosen state' of a certain tea.
     *
     * @param integer ID of tea you want to get data from
     * @returns array teaData
     * @throws teaTimerInvalidTeaIDException
     **/
    this.getTeaData=function(id)
    {
	if(self.checkTeaWithID(id)===false)
	{
	    throw new teaTimerInvalidTeaIDException("getTeaData: Invalid ID given.");
	}

	var name=teaDB.getCharPref(id+".name");
	var time=teaDB.getIntPref(id+".time");
	var choosen=teaDB.getBoolPref(id+".checked");
	var hidden=false;
	try
	{
	    var hidden=teaDB.getBoolPref(id+".hidden");
	}
	catch(e)
	{

	}

	return {"ID":id,"name":name,"time":time,"choosen":choosen,"hidden":hidden};
    }

    /**
     * This method can be used to get an array with all teas and the corresponding data.
     *
     * Structure of array is:
     * 	Array(
     *		1=>Array(ID,name,time,choosen),
     *		2=>Array(ID,name,time,choosen)
     *		...
     * 		)
     *
     * @param bool includehidden (include hidden teas also)
     * @param string sorting (id, name ASC, name DESC, time ASC, time DESC)
     * @returns array
     **/
    this.getDataOfAllTeas=function(includehidden,sorting)
    {
		includehidden=((includehidden===true)?true:false);
		var teaIDs=self.getIDsOfTeas(includehidden,sorting);
		var teas=new Array();
		for(var i in teaIDs)
		{
			teas.push(self.getTeaData(teaIDs[i]));
		}

		return teas;
    }

    /**
     * This method returns the ID of the currently choosen/checked tea.
     * @returns integer teaID
     **/
    this.getIdOfCurrentTea=function()
    {
		var id=1;
		var teaIDs=self.getIDsOfTeas();
		for(var i in teaIDs)
		{
			var tea=self.getTeaData(teaIDs[i]);
			if(tea["choosen"]===true)
			{
				id=teaIDs[i];
				break;
			}
		}

		return id;
    }

    /**
     * This method returns an array with all available tea IDs.
     * @param bool includehidden (include hidden teas also)
     * @param string sorting (id, name ASC, name DESC, time ASC, time DESC)
     * @returns array teaIDs
     **/
    this.getIDsOfTeas=function(includehidden,sorting)
    {
		includehidden=((includehidden===true)?true:false);
		try
		{
			common.validateSortingOrder(sorting);
		}
		catch(e)
		{
			sorting="id";
		}

		var teas=new Array();
		var numberOfTeas=self.getNumberOfTeas();
        const offset=23;
        var end=offset;
		for(var i=1; i<=end; i++)
		{
			if(self.checkTeaWithID(i))
			{
				if(
				   (includehidden===false && self.getTeaData(i)["hidden"]===false) ||
				   (includehidden===true)
				)
				{
					teas.push(i);
					end=i+offset;
				}
			}

			if(teas.length-1===numberOfTeas)
			{
				break;
			}
		}

		if(sorting!=="id")
		{
			try
			{
				var stop=true;
				do
				{
					stop=true;
					for(i=0; i<teas.length-1; i++)
					{
						var thisTea=self.getTeaData(teas[i]);
						var nextTea=self.getTeaData(teas[i+1]);
						if(
							(sorting==="time ASC" && thisTea.time>nextTea.time) ||
							(sorting==="time DESC" && thisTea.time<nextTea.time) ||
							(sorting==="name ASC" && thisTea.name.toLowerCase()>nextTea.name.toLowerCase()) ||
							(sorting==="name DESC" && thisTea.name.toLowerCase()<nextTea.name.toLowerCase())
						)
						{
							tmp=teas[i];
							teas[i]=teas[i+1];
							teas[i+1]=tmp;
							stop=false;
						}
					}
				}
				while(stop===false);
			}
			catch(e)
			{
				//if there was an error, ignore it, because it's better to return a wrong sorted list instead of failing at all.
			}
		}

		return teas;
    }

    /**
     * This method returns an array with all tea IDs of teas, that are marked for deletion (hidden).
     * @returns array teaIDs
     **/
    this.getIDsOfHiddenTeas=function()
    {
        var teas=self.getIDsOfTeas(true);
        var hiddenTeas=new Array();
        for(var i=0; i<teas.length; i++)
        {
            var teaID=teas[i];
            if(self.getTeaData(teaID)["hidden"]===true)
            {
                hiddenTeas.push(teaID);
            }
        }

        return hiddenTeas;

    }
    /**
     * Use this method to tell the database, that a certain tea is choosen.
     * The corresponding flag is set in the database for all teas.
     *
     * @param integer teaID
     * @throws teaTimerInvalidTeaIDException
     **/
    this.setTeaChecked=function(id)
    {
	if(self.checkTeaWithID(id)!==true)
	{
	    throw new teaTimerInvalidTeaIDException("setTeaChecked: There's no tea with ID '"+id+"'.");
	}

	var teas=self.getIDsOfTeas();
	for(var i in teas)
	{
	    var teaID=teas[i];
	    teaDB.setBoolPref(teaID+".checked",((teaID===id)?true:false));
	}
    }

    /**
     * This private method returns the brewing time (in seconds) of the currenlty choosen tea.
     * @returns integer brewing time in seconds
     **/
    this.getSteepingTimeOfCurrentTea=function()
    {
	var time=null;
	try
	{
	    time=self.getTeaData(self.getIdOfCurrentTea())["time"];
	}
	catch(e)
	{
	    var firstTeaID=self.getIDsOfTeas()[0];
	    self.setTeaChecked(firstTeaID);
	    time=self.getTeaData(firstTeaID)["time"];
	}

	return time;
    }
}

function teaTimerInvalidTeaIDException(msg)
{
    this.name="teaTimerInvalidTeaIDException";
    this.message=((msg===undefined)?null:msg);
}

function teaTimerInvalidTeaTimeException(msg)
{
    this.name="teaTimerInvalidTeaTimeException";
    this.message=((msg===undefined)?null:msg);
}
