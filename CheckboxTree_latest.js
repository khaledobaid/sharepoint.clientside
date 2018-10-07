// <reference path="\sitename\MicrosoftAjax.js" />
/// <reference path="\sitename\SP.debug.js" />
/// <reference path="\sitename\jquery-1.11.0.js" />

var currentFormUniqueId;
var currentFormctx;

var firstListName = "Entities";
var secondListName = "Contacts";
var parentListId = "Entity_x003a__x0627__x0644__x064";

var _controlsToHide =
    [
    "[id$='_AllDayEventField']",
    "[id$='_CrossProjectLinkField']",
    "[id$='_RecurrenceField']",
    "[id^='RequestID_']",
    "[id^='EntitiesString_']",
    "[id^='ContactsString_']",
    "[id^='LatestInvitation_']",
    "[id^='LatestSMS_']"
    ];

var _viewControlNames =
    [
        "fAllDayEvent",
        "fRecurrence",
        "WorkspaceLink",
        "Contacts",
        "Entities",
        "LatestInvitation",
        "LatestSMS",
        "IsInvitationSent",
        "IsSMSSent",
        "RequestID"
    ];

var firstListItems = new Array();
var secondListItems = new Array();

var FirstListSelectedItems = "";
var SecondListSelectedItems = "";

var formLoaded = false;


(function ()
{
    // Enusre loading jquery
    (window.jQuery || document.write('<script src="/Style Library/JS/jquery-1.11.0.min.js"><\/script>'));

    // CSR preperae
    var fieldCtx = {};
    fieldCtx.Templates = {};
    fieldCtx.Templates.OnPostRender = onPostRender;
    fieldCtx.Templates.Fields =
        {
            "Entities":
                {
                    "NewForm": newEntities,
                    "EditForm": newEntities
                },
            "Contacts":
                {
                    "NewForm": newContacts,
                    "EditForm": newContacts
                }
        };
    SPClientTemplates.TemplateManager.RegisterTemplateOverrides(fieldCtx);

})();


function newEntities(ctx)
{
    // Get the field context from the form
    var formCtx = SPClientTemplates.Utility.GetFormContextForCurrentField(ctx);
    firstListItems = formCtx.fieldSchema.Choices;


    // For edit purposes
    FirstListSelectedItems = formCtx.fieldValue;

    // Register a callback just before submit.
    formCtx.registerGetValueCallback(formCtx.fieldName, function ()
    {
        var returnValue = "";
        var items = $("input[data-type='value-parent'][checked='checked']");
        items.each(function (index, item)
        {
            var id = $(item).attr("data-id");
            var name = $(item).parent().children("label").text();

            returnValue += id;
            returnValue += ";#";
            returnValue += name;

            if (index != items.length - 1)
                returnValue += ";#";
        });
        return returnValue;
    });
    return "<div id='firstList'></div>";
}

function newContacts(ctx)
{
    // Get the field context from the form
    var formCtx = SPClientTemplates.Utility.GetFormContextForCurrentField(ctx);
    secondListItems = formCtx.fieldSchema.Choices;

    // For edit purposes
    SecondListSelectedItems = formCtx.fieldValue;

    // Register a callback just before submit.
    formCtx.registerGetValueCallback(formCtx.fieldName, function ()
    {
        var returnValue = "";
        var items = $("input[data-type='value-child'][checked='checked']");
        items.each(function (index, item)
        {
            var id = $(item).attr("data-id");
            var name = $(item).parent().children("label").text();

            returnValue += id;
            returnValue += ";#";
            returnValue += name;

            if (index != items.length - 1)
                returnValue += ";#";
        });
        return returnValue;
    });

    return "<div id='secondList'></div>";
}

function onPostRender(ctx)
{
    if (ctx.ListSchema.Field[0].Name == firstListName)
        $('#firstList').parent().parent().hide();
    else if (ctx.ListSchema.Field[0].Name == secondListName)
    {
        $('#secondList').addClass("ms-long");
        $('#secondList').css("height", "300px");
        $('#secondList').css("overflow-y", "auto");
        $('#secondList').css("border", "1px solid #ABABAB");
    }
}

ExecuteOrDelayUntilScriptLoaded(Start, "sp.js");


function SortByName(a, b)
{
  var aName = a.ParentName.toLowerCase();
  var bName = b.ParentName.toLowerCase(); 
  return ((aName < bName) ? -1 : ((aName > bName) ? 1 : 0));
}


function Start()
{
    JSRequest.EnsureSetup();

    if (JSRequest.FileName == "DispForm.aspx")
    {
    	// Hide Controls In View Form
        $.each(_viewControlNames, function (index, item)
        {
            $("*[name=SPBookmark_" + item + "]").closest("tr").hide();
        })
    }
    else if (JSRequest.FileName == "EditForm.aspx" || JSRequest.FileName == "NewForm.aspx")
    {      
    	// Hide Controls In Edit and Add Forms
        $.each(_controlsToHide, function (index, item)
        {
            $(item).closest("tr").hide();
        });
        
        // Call this to refresh and call handler
        if (JSRequest.FileName == "EditForm.aspx")
            ShowHideContacts($("[id^='Category_']").prop("selectedIndex"));

        $("[id^='Category_']").change(function ()
        {
            ShowHideContacts($(this).prop("selectedIndex"));
        });

        // Manage Start And End Dates       
        StartDateField = $("[id='StartDate_64cd368d-2f95-4bfc-a1f9-8d4324ecb007_$DateTimeFieldDate']");
        EndDateField = $("[id='EndDate_2684f9f2-54be-429f-ba06-76754fc056bf_$DateTimeFieldDate']");

        EndDateField.attr("disabled", "disabled")
        StartDateField.focus(function ()
        {
            EndDateField.val(StartDateField.val());
        });


        var Result = null;
        var ctx = SP.ClientContext.get_current();
        var lst = ctx.get_web().get_lists().getByTitle(secondListName);
        var camlQuery = new SP.CamlQuery();
        var txtQuery = "<ViewFields><FieldRef Name='ID' /><FieldRef Name='" + parentListId + "' /></ViewFields>";
        camlQuery.set_viewXml(txtQuery);
        Result = lst.getItems(camlQuery);
        ctx.load(Result, "Include(ID," + parentListId + ")");
        ctx.executeQueryAsync(function (data)
        {
            var listItemEnumerator = Result.getEnumerator();
            while (listItemEnumerator.moveNext())
            {
                var oListItem = listItemEnumerator.get_current();

                var itemId = oListItem.get_item("ID");
                var parentId = oListItem.get_item(parentListId).get_lookupId();

                TreeItems.push(new TreeNode(itemId, getArrayValueByID(itemId, secondListItems), parentId, getArrayValueByID(parentId, firstListItems)));
            }

	TreeItems.sort(SortByName);

            RenderTree();

            if (FirstListSelectedItems != "" || SecondListSelectedItems != "")
            {
                try
                {
                    var firstSelected = new Array();
                    var secondSelected = new Array();

                    firstSelected = FirstListSelectedItems.split(";#");
                    secondSelected = SecondListSelectedItems.split(";#");

                    for (var i = 0; i < firstSelected.length; i += 2)
                        $("input[data-type='value-parent'][data-id='" + firstSelected[i] + "']").attr("checked", "checked");

                    for (var i = 0; i < secondSelected.length; i += 2)
                    {
                        $("input[data-type='value-child'][data-id='" + secondSelected[i] + "']").attr("checked", "checked");
                        $("input[data-type='value-child'][data-id='" + secondSelected[i] + "']").change();
                    }
                }
                catch (e)
                {
                    alert(e.message);
                }

            }

        }, function ()
        {
            alert('Error');
        });
    }
}

function ShowHideContacts(index)
{
    if (index > 1)
        $("#secondList").closest("tr").hide();
    else
        $("#secondList").closest("tr").show();
}

function RenderTree()
{
    try
    {
        var currentParentIds = new Array();

        var unOrderedList = document.createElement("ul");
        unOrderedList.style.listStyleType = "none";
        unOrderedList.style.margin = "4px";
        unOrderedList.style.padding = "0px";
        $("#secondList").append(unOrderedList);

        for (var i = 0; i < TreeItems.length; i++)
        {
            var item = TreeItems[i];

            var parentIndex = $.inArray(item.ParentID, currentParentIds);

            if (parentIndex != -1)
            {
                // Parent is already exist
                AddChildItem(unOrderedList.childNodes[parentIndex].lastChild, item.ItemName, item.ItemID);
            }
            else
            {
                currentParentIds.push(item.ParentID);

                var lisItemLi = document.createElement("li");
                lisItemLi.style.marginBottom = "8px";
                var newParent = CreateParentList(lisItemLi, item.ParentName, item.ParentID);
                AddChildItem(newParent, item.ItemName, item.ItemID);
                unOrderedList.appendChild(lisItemLi);
            }
        }
    }
    catch (e)
    {
        alert(e.message);
    }

}


function CreateParentList(Parent, Name, ID)
{
    var parentCheckbox = document.createElement("input");
    parentCheckbox.type = "checkbox";
    parentCheckbox.id = "entity_check_" + ID;
    parentCheckbox.setAttribute("data-id", ID);
    parentCheckbox.setAttribute("data-type", "value-parent");

    

    parentCheckbox.addEventListener("change", function (event)
    {
        var relatedList = event.srcElement.parentElement.lastChild;
        if (event.srcElement.checked)
            $(event.srcElement).attr("checked", "checked");
        else
            $(event.srcElement).removeAttr("checked");

        for (var i = 0; i < relatedList.childNodes.length; i++)
        {
            relatedList.childNodes[i].firstChild.checked = event.srcElement.checked;

            if (event.srcElement.checked)
                $(relatedList.childNodes[i].firstChild).attr("checked", "checked");
            else
                $(relatedList.childNodes[i].firstChild).removeAttr("checked");
        }
    });

    var parentLable = document.createElement("label");
    parentLable.attributes["for"] = "entity_check_" + ID;
    parentLable.innerText = Name;
    parentLable.style.fontSize = "13px";
    parentLable.style.fontWeight = "bold";
    parentLable.style.margin = "4px";

    var expand = document.createElement("span");
    expand.innerText = "+";
    expand.onclick = function ()
    {
        var ulItem = this.parentNode.childNodes[4];
        this.style.display = "none";
        ulItem.style.display = "block";
        this.parentNode.childNodes[1].style.display = "inline";
    };

    expand.style.cursor = "Pointer";
    expand.style.fontFamily = "Courier New";
    expand.style.fontSize = "8pt";
    expand.style.fontWeight = "bold";
    expand.style.marginTop = "4px";


    var collapse = document.createElement("span");
    collapse.innerText = "-";
    collapse.onclick = function ()
    {
        var ulItem = this.parentNode.childNodes[4];
        this.style.display = "none";
        ulItem.style.display = "none";
        this.parentNode.childNodes[0].style.display = "inline";
    };

    collapse.style.cursor = "Pointer";
    collapse.style.fontFamily = "Courier New";
    collapse.style.fontSize = "8pt";
    collapse.style.fontWeight = "bold";
    collapse.style.marginTop = "4px";
    collapse.style.display = "none";

    var lisItemUl = document.createElement("ul");
    lisItemUl.style.listStyleType = "none";
    lisItemUl.style.margin = "0px";
    lisItemUl.style.padding = "2px";
    lisItemUl.style.paddingTop = "4px";
    lisItemUl.style.paddingLeft = "16px";
    lisItemUl.style.paddingRight = "16px";
    lisItemUl.style.display = "none";

    Parent.appendChild(expand);
    Parent.appendChild(collapse);
    Parent.appendChild(parentCheckbox);
    Parent.appendChild(parentLable);
    Parent.appendChild(lisItemUl);

    return lisItemUl;
}

function AddChildItem(Parent, Name, ID)
{
    var childItem = document.createElement("li");

    var childCheckbox = document.createElement("input");
    childCheckbox.type = "checkbox";
    childCheckbox.id = "child_check_" + ID;
    childCheckbox.setAttribute("data-id", ID);
    childCheckbox.setAttribute("data-type", "value-child");

    $(childCheckbox).change(function ()
    {
        var srcElement = document.getElementById($(this).attr("id"));
        var parentList = srcElement.parentElement.parentElement;
        if (srcElement.checked)
            $(srcElement).attr("checked", "checked");
        else
            $(srcElement).removeAttr("checked");

        var NoChecked = true;
        for (var i = 0; i < parentList.childNodes.length; i++)
        {
            if (parentList.childNodes[i].firstChild.checked)
            {
                NoChecked = false;
                break;
            }
        }

        parentList.parentElement.childNodes[2].checked = !NoChecked;

        if (NoChecked)
            $(parentList.parentElement.childNodes[2]).removeAttr("checked");
        else
            $(parentList.parentElement.childNodes[2]).attr("checked", "checked");


    });

    //childCheckbox.addEventListener("change", function (event)
    //{
    //    alert('Changed');
    //    var parentList = event.srcElement.parentElement.parentElement;
    //    if (event.srcElement.checked)
    //        $(event.srcElement).attr("checked", "checked");
    //    else
    //        $(event.srcElement).removeAttr("checked");

    //    var NoChecked = true;
    //    for (var i = 0; i < parentList.childNodes.length; i++)
    //    {
    //        if (parentList.childNodes[i].firstChild.checked)
    //        {
    //            NoChecked = false;
    //            break;
    //        }
    //    }

    //    parentList.parentElement.childNodes[2].checked = !NoChecked;

    //    if (NoChecked)
    //        $(parentList.parentElement.firstChild).removeAttr("checked");
    //    else
    //        $(parentList.parentElement.firstChild).attr("checked", "checked");

    //});

    var childLable = document.createElement("label");
    childLable.attributes["for"] = "child_check_" + ID;
    childLable.innerText = Name;
    childLable.style.fontSize = "11px";

    childItem.appendChild(childCheckbox);
    childItem.appendChild(childLable);
    Parent.appendChild(childItem);
}


function getArrayValueByID(id, array)
{
    return $.grep(array, function (e) { return e.LookupId == id; })[0].LookupValue;
}

var TreeItems = new Array()
TreeNode = function (ItemID, ItemName, ParentID, ParentName)
{
    this.ItemID = ItemID;
    this.ItemName = ItemName;
    this.ParentID = ParentID;
    this.ParentName = ParentName;
}

