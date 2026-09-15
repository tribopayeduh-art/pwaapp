var gradle = { log: function(val){val && console.log( gradle.isMobile && (typeof val === 'object') ? JSON.stringify(val) : val );},
/**
	GRADLE - KNOWLEDGE IS POWER
	***** JACOB SERVICES LLC ***
    ***** PROPRIETARY CODE *****
    @author : gradle (jacob.services@outlook.com)
	@date: 09/20/2021 09:56:00
	@version: 7.0.0
	copyright @2021
*/

	intervalAds    : 1,     //Ads each interval for example each 3 times
	
	//Game settings :
	//===============
	path_single_color : false,
	path_alpha        : 1,  //alpha between 0.01 and 1 (1=no transparency)


	// more games :
	//=============
	enableMoreGames   : true, //set to true to make the button (i) redirect to the developer link

	
	
	//Events manager :
	//================
	event: function(ev, msg){
		try { window.parent.postMessage({ source: 'zumbla-game', event: ev, payload: msg || {} }, window.location.origin); } catch (e) {}
		if(gradle.process(ev,msg))
        switch(ev){

		case 'SCREEN_LEVELSELECT': //Button play
			//gradle.showInter();
			break;
		case 'EVENT_LEVELSTART':
			gradle.checkInterval() && gradle.showInter(); // <-- we check the interval if ok we show interstitial
			break;
		case 'oveer_button_back':
			//gradle.showInter();
			break;
		case 'EVENT_LEVELSUCCESS':
			//gradle.showInter();
			break;
		case 'EVENT_LEVELFAIL':
			//gradle.showInter();
			break;
		case 'SCREEN_PAUSE':
			//gradle.showInter();
		case 'EVENT_VOLUMECHANGE':
			//gradle.showInter();
			break;
		case 'SCREEN_CREDITS':
			//gradle.showInter();
			break;
			
		case 'MORE_GAMES': //event on button share
			gradle.event_ext('show_more');
			break;
			
   		case 'btn_share': //event on button share
			gradle.event_ext('show_share');
			break;
			
		
		case 'test':
			//gradle.checkInterval() && gradle.showInter();
			break;
		
        }
    },





    //Ready : /!\ DO NOT CHANGE, ONLY IF YOU ARE AN EXPERT.
    //=========================
	start: function(){
		try {
			var saved = JSON.parse(localStorage.getItem('gradle_v3.8.2') || '{}');
			saved.level = saved.level || 1;
			saved.scores = saved.scores || new Array(61).fill(0);
			saved.tutorialFirstStageCompleted = true;
			saved.tutorialSecondStageCompleted = true;
			saved.wheelTutorialCompleted = true;
			saved.wheelFirstTimeSpin = true;
			localStorage.setItem('gradle_v3.8.2', JSON.stringify(saved));
		} catch (e) {}
		function onTouchPreventDefault(event) {
			//event.preventDefault();
		}
		document.addEventListener("touchmove", onTouchPreventDefault, false);
		document.addEventListener("touchstart", onTouchPreventDefault, false);
		window["game"] = new src.App();
		//gradle.hideSplash();
		
		function handleVisibilityChange() {
			window.gradle_ad || (document[hidden] ? (isPageVisible = !1, game && game.pauseGame()) : (isPageVisible = !0, game && game.unpauseGame()))
		}
		
		void 0 !== document.hidden ? (hidden = "hidden", visibilityChange = "visibilitychange") : void 0 !== document.msHidden ? (hidden = "msHidden", visibilityChange = "msvisibilitychange") : void 0 !== document.webkitHidden && (hidden = "webkitHidden", visibilityChange = "webkitvisibilitychange"), void 0 === document.addEventListener || void 0 === document[hidden] ? gradle.event("Browser doesn't support the Page Visibility API.") : document.addEventListener(visibilityChange, handleVisibilityChange, !1);

        //setTimeout(function(){sizeHandler();gradle.event_ext('hide_splash');}, 600);
    },
	pause: function(){
		console.log('gradle pause ...');
		gradle_onPauseRequested();
    },
	resume: function(){
		console.log('gradle resume ...');
		gradle_onResumeRequested();
    },

    run: function() {
        gradle.event('first_start');
		gradle.isMobile = ( /(ipad|iphone|ipod|android|windows phone)/i.test(navigator.userAgent) );
        document.addEventListener("visibilitychange", gradle.onVisibilityChanged, false);
		gradle.start();
    },

	mute: false,
    event_ext: function(val){
		if(this.isMobile && typeof jacob!='undefined'){
			jacob.do_event(val);
		}
	},
	unlock_all_levels : true,
	old_ev: null,
    process: function(ev, msg){
		if(gradle.old_ev ==ev){
			if(ev=='button_share' || ev=='button_play'){
				console.log('repeat');
				//return false;
			}
		}
        if(ev=='state_game_create'){
			null != game && (game.sound.mute = !1, game.paused = !1);
			//this.triggerEvent(document.getElementById('game'), 'click');
		}
		gradle.old_ev = ev;
		gradle.log(ev,msg);
		return true;
    },

    showInter: function(){
        if(!gradle.isMobile) return;
        gradle.log('jacob|show_inter');
    },

	onVisibilityChanged : function(){
	    if (document.hidden || document.mozHidden || document.webkitHidden || document.msHidden){
			gradle.pause();
		}else{
			gradle.resume();
		}
	},

	currentInterval : 0,
	checkInterval: function(){
		return (++gradle.currentInterval==gradle.intervalAds) ? !(gradle.currentInterval=0) : !1;
	}
};
var oMain;
gradle.run();
