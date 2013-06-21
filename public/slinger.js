(function(jQuery) {

var CACHE = {};
var COUNTER = 0;
var CURRENT = null;

var slinger = {
    //	##nextId
    //
    //	Increments and returns the counter.
    //
    nextId : function(pref) {
    	COUNTER += 1;
    	return pref ? pref.toString() + COUNTER : COUNTER;
    },
    //  ##loadModules
    //
	loadModules : function(loadCb) {

		var $newModules	= jQuery("module, .module").not(".__mloading");
		var $mods   	= $([]);
		var mHit    	= {};
		var mList		= [];		

		var paint = function(mod, data) {
			var $mod 	= jQuery(mod);
			var mid		= $mod.attr("id");
			var mname	= $mod.attr("name");
			var cpath   = mname.replace("/","`");
			var mData	= data[cpath];
	
			if(!mData) {
				return;
			}

			//	All modules must have an #id
			//
			if(!mid) {
				mid = slinger.nextId("_");
				$mod.attr("id", mid);
			}
			
			var atts 	    = $mod.attr("data-args");
			var insmode	    = $mod.attr("data-insert-mode") || "append";
			var attObj		= {};
			var kv;
			var aval;
			var avals;

			//	If there are data-attr values, parse those into a map, to be sent to init
			//
			if(atts) {
				jQuery.each(atts.split(";"), function(idx, p) {
					kv 	= p.split(":");
					aval = jQuery.trim(kv[1]);
					avals = aval.split(",");
					if(avals.length > 1) {
						aval = avals
					}
					attObj[jQuery.trim(kv[0])] = aval;
				});
			}

			//	@see	#initialize
			//
			CURRENT = {
				$el 	: $mod,
				id		: mid,
				name	: mname,
				args	: attObj
			};

			mData.css 	&& jQuery("<style type=\"text/css\">" + mData.css + "</style>").appendTo(document.head);
			mData.html 	&& $mod[insmode] && $mod[insmode](mData.html);
			mData.js 	&& jQuery.globalEval(mData.js);
			
			CURRENT = null;

			//	Cache result. Note we don't CACHE css, as this persists, and needs not
			//	be reloaded, or otherwise re-processed.
			//
			CACHE[cpath] = {
				html	    : mData.html,
				js		    : mData.js
			};
			
			//	This is checked within module #ready method, see below.
			//
			$mod.addClass("__mloaded");
		};

		//	Get unique list of new modules. 
		//	We only need to load a module one time, using CACHE from then on.
		//	
		$newModules.each(function() {
		    var $t  = jQuery(this);
		    var n   = $t.attr("name");
		    if(!mHit[n]) {
		        mHit[n] = 1;
		        $mods = $mods.add($t);
		    }
		});

        //  Run through each raw module, adding relevant classes to indicate state,
        //  run CACHEd data if exists, otherwise push module #name to accumulator
        //  for later processing.
        //
		$mods.each(function() {

			var $t 		= jQuery(this);
			var name 	= $t.attr("name").replace("/","`");
			var ob 		= {};
			
			//	All modules are given a "module" class, even if using
			//	the <module> system, as well as "module-themodulename"
			//
			$t.addClass("module-" + name + " __mloading module");
			
			if(CACHE[name]) {
				console.log("*** CACHED : " + name);
				ob[name] = CACHE[name];
				return paint(this, ob);
			} 

			name && mList.push(name);
		});
		
		//  This pass is done. Any submodules?
		//
		if(!mList.length) {
			if($newModules.length > $mods.length) {
				return slinger.loadModules(loadCb);
			}
			loadCb && loadCb();
			console.log("FINIS");
			return;
		}
		
		//  Fetch the module group
		//
		jQuery.getJSON("/module/" + mList.join("|"), function(data) {

			$mods.each(function() {
				paint(this, data);
			});
			
			//	A module may introduce more modules.
			//
			slinger.loadModules(loadCb);
		});

		return slinger;
	},

    //  ##insertModule
    //
    insertModule : function($targ, defs) {
    
        defs = defs || {};

        $targ = typeof $targ === "string" ? jQuery($targ) : $targ;
        
        defs = !jQuery.isArray(defs) ? [defs] : defs;
	    
	    jQuery.each(defs, function(idx, o) {
	        //  Must have an #id
			//
			o.id = o.id || slinger.nextId("__m__");
            $targ[o.method || 'html']('<module id="' + o.id + '" name="' + o.name + '"></module>');	 
	    });
	    
	    //  When modules are loaded fire any sent callbacks in the scope of module $element
	    //
        slinger.loadModules(function() {
            jQuery.each(defs, function(idx, o) {
                o.callback && o.callback.call(jQuery("#" + o.id));
            });
        })
    }, 
    
    initialize : function(fn) {
    	fn.call(CURRENT);
    },
    
    //	Brevity...
    //
    init : function(fn) {
    	slinger.initialize(fn);
    }
};

$(function() {
	document.createElement("module");
	slinger.loadModules();
});

window.slinger = slinger;

})(jQuery);