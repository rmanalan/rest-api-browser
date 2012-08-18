AJS.$(function($){

    // Don't bother running this if it's IE
    if(!$.support.boxModel || !$.support.noCloneChecked) {
        return false;
    }

    function getQueryParamByName(name){
        name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
        var regexS = "[\\?&]" + name + "=([^&#]*)";
        var regex = new RegExp(regexS);
        var results = regex.exec(window.location.search);
        if(results == null)
            return false;
        else
            return decodeURIComponent(results[1].replace(/\+/g, " "));
    }

    // Global dtToolbar object stores helper props/funcs for others who want to plug into the toolbar
    window.dtToolbar = {};
    dtToolbar.baseUrl = "%%BASEURL%%"; dtToolbar.contextPath = dtToolbar.baseUrl.split('/').length > 3 ? "/" + dtToolbar.baseUrl.split('/') [3] : "/";

    function toggleToolbar(){
        if($('.dt-toolbar').hasClass('dt-expando-expanded')) {
            $('.dt-toolbar').removeClass('dt-expando-expanded');
            localStorage.setItem('dev.toolbar.enabled',false);
        } else {
            $('.dt-toolbar').addClass('dt-expando-expanded');
            localStorage.setItem('dev.toolbar.enabled',true);
        }
    }

    $('body').delegate('.dt-expando','click',toggleToolbar);

    AJS.whenIType('dt').execute(toggleToolbar);

    function getUri(){
        return window.location.origin + window.location.pathname;
    }

    dtToolbar.init = function(d){
        $('body').append(d);
        if(localStorage.getItem('dev.toolbar.enabled') === "true") {
            toggleToolbar();
        }

        $('body').delegate('#dt-highlight-i18n','click',function(){
            var i18nParam = getQueryParamByName('i18ntranslate');
            if(!i18nParam) {
                window.location = window.location.search ? getUri() + window.location.search + "&i18ntranslate=on" + window.location.hash : getUri() + "?i18ntranslate=on" + window.location.hash;
            } else {
                if(i18nParam === "on") {
                    window.location = window.location.href.replace("i18ntranslate=on","i18ntranslate=off");
                }else{
                    window.location = window.location.href.replace("i18ntranslate=off","i18ntranslate=on");
                }
            }
        });
    }

    $.ajax({
        type: 'GET',
        url: dtToolbar.contextPath + "/plugins/servlet/dev-toolbar",
        dataType: 'html',
        success: dtToolbar.init
    });

    function toggleMenu(e){
        var $this = $('.dt-toolbox-btn');
        if($this.find('.dt-menu').hasClass('dt-expand')){
            $this.find('.dt-menu').removeClass('dt-expand');
        }else{
            $this.find('.dt-menu').addClass('dt-expand');
            if($(e.currentTarget).hasClass('dt-brand'))
                $('html').one('click',toggleMenu);
        }
        e.stopImmediatePropagation();
    }

    $('body').delegate('.dt-brand','click',toggleMenu);

});

