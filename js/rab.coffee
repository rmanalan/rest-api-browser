services = [
  wadl: "jira.wadl"
  path: "https://api.bitbucket.org/1.0"
  version: "1.0"
  pluginCompleteKey: "jira"
  pluginName: "rab"
  pluginDescription: "some descr"
]

angular.module('rab.directives',[])
  .directive 'rabScrollfix', ['$window', '$document', ($window, $document) ->
    'use strict'
    link: (scope, elem, attrs) ->
      calculateBoxes = ->
        $(".rab-sidebar").height ->
          $(window).height - 10
        window.rabProps =
          origSidebarTop: $(".rab-sidebar").scrollTop()
          origSidebarOffsetTop: $(".rab-sidebar").offset().top
          origSidebarWidth: $(".rab-sidebar").width()
          winHeight: $(window).height()

      calculateBoxes()

      # Scroll into view 
      setTimeout ->
        return unless location.hash
        anchor = document.getElementById(location.hash.split('#')[1])
        anchor.scrollIntoView() if anchor
      , 100


      angular.element($window).on 'resize', ->
        calculateBoxes()

      angular.element($window).on 'scroll.rab-scrollfix', ->
        x = $(".rab-resources").position().left
        top = $(window).scrollTop() - 15
        elFromPoint = $(document.elementFromPoint(x, 5))

        # Highlight selected resource in sidebar as the main content
        # is scrolled.
        if elFromPoint.hasClass("rab-resource")
          $(".rab-resource-sb a").removeClass "rab-resource-sb-active"
          $("#rab-nav-" + elFromPoint.find('h3>a').data('id')).addClass "rab-resource-sb-active"

        # Fix the sidebar as the main content container is scrolled allowing
        # for easy access to resources without it scrolling off the screen.
        currPosn = top + window.rabProps.winHeight
        if top > window.rabProps.origSidebarOffsetTop
          contentBottom = @origSidebarOffsetTop + $(".rab-content").height()
          if currPosn > contentBottom 
            $(".rab-sidebar").css top: contentBottom - currPosn
          else
            $('.rab-sidebar').height ->
              $(window).height()

            $(".rab-sidebar").css
              position: "fixed"
              top: 0
              width: window.rabProps.origSidebarWidth

            $(".rab-content").css marginLeft: "20%"
        else
          $('.rab-sidebar').height 'auto'
          $(".rab-sidebar").css
            position: "static"
            width: "20%"

          $(".rab-content").css marginLeft: "0"
    ]

angular.module('rab.service',['ngSanitize'])
  .value 'helper',
    slugify: (str) ->
      return unless this
      str.toLowerCase()
        .replace(/[^-a-zA-Z0-9,&\s]+/ig, '-')
        .replace(/\s/gi, "-")
        .replace(/^-/, '')
        .replace(/-$/, '')

angular.module('rab',['rab.service','rab.directives'])

class ServiceSelectorController
  constructor: ($scope) ->
    $scope.services = services
    $scope.currentService = @getCurrentService()

  getCurrentService: ->
    services[0]

class ResourceSidebarController
  constructor: ($scope, helper) ->
    $scope.resources = []
    $scope.scrollToResource = @scrollToResource
    $scope.slugify = helper.slugify
    processWADL(services[0].wadl).done (d) ->
      $scope.$apply ->
        $scope.resources = d.resources

class ResourceMainController
  constructor: ($scope, helper) ->
    $scope.slugify = @slugify
    $scope.fullUrl = @getFullUrl
    $scope.slugify = helper.slugify


  getFullUrl: (path)->
    servicesScope = angular.element('.rab-service-selector.ng-scope').scope();
    servicesScope.currentService.path + path
