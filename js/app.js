$(function() {

    rest = {};
    rest.services = [
        {
            "wadl": "bb-wadl.xml",
            "path": "https://api.bitbucket.org/1.0",
            "version": "1.0",
            "pluginCompleteKey": "jira",
            "pluginName": "rab",
            "pluginDescription": "some descr"
        }
    ];
    rest.jsonRpcs = [];

    rest.slugify = function(str) {
        return str.toLowerCase().replace(/[^-a-zA-Z0-9,&\s]+/ig, '-').replace(/\s/gi, "-").replace(/^-/, '').replace(/-$/, '');
    };

    var Service = Backbone.Model.extend({});
    var Services = Backbone.Collection.extend({
        model: Service,
        findByKey: function(key) {
            return services.find(function(s) {
                return s.get('pluginCompleteKey') === key;
            });
        }
    });

    var Resource = Backbone.Model.extend({});
    var Resources = Backbone.Collection.extend({
        model: Resource
    });

    var services = [];
    rest.services = rest.services.sort(function(x, y) {
        return (x.pluginName < y.pluginName) ? - 1 : 1;
    });
    $.each(rest.services, function() {
        this.pluginCompleteKey = rest.slugify(this.pluginCompleteKey);
        services.push(new Service(this));
    });
    services = new Services(services);


    var ResourceBody = Backbone.View.extend({
        template: $('#rab-resource-body'),
        el: $('#rab'),
        initialize: function() {
            this.render();

            // Size and position sidebar and main content properly
            appViewController.sizeBoxes();
        },
        render: function() {
            $(window).scrollTop(0);
            console.log(1, this.model.toJSON(),this.$el.html());
            this.$el.html(this.template.tmpl(this.model.toJSON()));
        }
    });

    var CurrentService = Backbone.View.extend({
        el: $('.rab-curr-service'),
        template: $('#rab-header-tmpl'),
        initialize: function(model) {
            this.model = model;
            var self = this;
            this.render();
            new ServiceSelector(model);
            this.getResources(this.model.get('wadl'));
        },
        events: {
            'click .rab-name': 'toggleDD',
            'click .menu-item a': 'navigate'
        },
        render: function(model) {
            model = model || this.model;
            this.$('.rab-curr-head').html(this.template.tmpl(model.attributes));
        },
        name: function() {
            return this.model.get('pluginCompleteKey');
        },
        getResources: function(wadlUrl) {
            var self = this;
            processWADL(wadlUrl).done(function(d) {
                self.model.set(d);
                new ResourceBody({
                    model: self.model
                });
                rest.resources = d;
            });
        },
        toggleDD: function(e) {
            if (this.$('.rab-services-dd').hasClass('rab-open')) {
                // Close the dd
                this.$('.rab-services-dd').removeClass('rab-open');
                this.$('.rab-dd-button').removeClass('rab-dd-button-open');
            } else {
                // Open the dd
                this.$('.rab-services-dd').css('left',
                    function() {
                        var point = e.clientX;
                        var left = e.clientX - ($(this).width() / 2);
                        return left > 0 ? left : 0;
                    }).addClass('rab-open');
                this.$('.rab-dd-button').addClass('rab-dd-button-open');

                var self = this;
                $('body').bind('click', function() {
                    if ($('.rab-services-dd').hasClass('rab-open')) {
                        self.toggleDD(e);
                    }
                    $('body').unbind('click');
                    return false
                });
            }
            return false;
        },
        navigate: function(e) {
            var target = $(e.currentTarget);

            // Disabled for Bamboo
            console.log('before routing',$('body'))
            if ($('body').id !== 'jira' && $('body').id !== 'com-atlassian-confluence') {
                console.log('routing')
                appRouter.navigate(target.attr('href'));
            }
            this.toggleDD(e);
            this.switchService(target.data('id'));
            return false;
        },
        switchService: function(key) {
            if (!key) {
                this.model = services.first();
            } else {
                this.model = services.findByKey(key);
            }
            this.render(this.model);
            this.getResources(this.model.get('wadl'));
        }
    });

    var ServicesDDItem = Backbone.View.extend({
        template: $('#rab-menu-item'),
        initialize: function() {
            this.render();
        },
        render: function() {
            $('.rab-services-dd').append(this.template.tmpl(this.model.toJSON()));
        }
    });

    var ServiceSelector = Backbone.View.extend({
        el: $('.rab-service-selector'),
        initialize: function(model) {
            services.each(function(service) {
                new ServicesDDItem({
                    model: service
                });
            });
        }
    });

    var BrowserView = Backbone.View.extend({
        initialize: function(model) {
            rest.currService = new CurrentService(model);
        }
    });

    // Main view controller. Initialized only once.
    var AppViewController = Backbone.View.extend({
        el: $(window),
        events: {
            'submit .rab-endpoint': 'performCall',
            'click .rab-clear': 'clearOutput',
            'resize': 'sizeBoxes',
            'click .rab-resources-sb a': 'scrollToResource',
            'scroll': 'handleScroll',
            'click .rab-add-custom-param': 'addCustomParam',
            'click .rab-delete-custom-param': 'deleteCustomParam'
        },
        initialize:function() {
            // Stupid fucking hack to combat against fecru's weird 
            // header positioning... lame.
            if ($('body > div.layoutCentredPane').length) {
                this.headerOffset = 0;
            } else {
                this.headerOffset = $('#header').height();
            }
        },
        addCustomParam: function(e) {
            var params = $(e.currentTarget).parent().parent();
            $('#rab-custom-param-tmpl').tmpl().insertBefore(params);
            return false;
        },
        deleteCustomParam: function(e) {
            $(e.currentTarget).parent().parent().remove();
            return false;
        },
        sizeBoxes: function() {
            var self = this;
            $('.rab-sidebar').height(function() {
                return self.$el.height() - 10;
            });
            this.origSidebarTop = $('.rab-sidebar').scrollTop();
            this.origSidebarOffsetTop = $('.rab-sidebar').offset().top;
            this.origSidebarWidth = $('.rab-sidebar').width();
            this.winHeight = this.$el.height();
            this.handleScroll();
        },
        handleScroll: function(w) {
            var currPosn, contentBottom, x = $('.rab-resources').position().left, top = this.$el.scrollTop(), elFromPoint = $(document.elementFromPoint(x, 5));

            // Highlight selected resource in sidebar as the main content
            // is scrolled.
            if (elFromPoint.hasClass('rab-resource')) {
                $('.rab-resource-sb a').removeClass('rab-resource-sb-active');
                $('#rab-nav-' + elFromPoint.data('id')).addClass('rab-resource-sb-active');
            }

            // Fix the sidebar as the main content container is scrolled allowing
            // for easy access to resources without it scrolling off the screen.
            currPosn = top + appViewController.winHeight;
            if (top > appViewController.origSidebarOffsetTop) {
                contentBottom = this.origSidebarOffsetTop + $('.rab-content').height();
                if (currPosn > contentBottom) {
                    $('.rab-sidebar').css({
                        top: contentBottom - currPosn
                    });
                } else {
                    $('.rab-sidebar').css({
                        position: "fixed",
                        top: 0,
                        width: appViewController.origSidebarWidth
                    });
                    $('.rab-content').css({
                        marginLeft: "20%"
                    });
                }
            } else {
                $('.rab-sidebar').css({
                    position: "static",
                    width: "20%"
                });
                $('.rab-content').css({
                    marginLeft: "0"
                });
            }
        },
        scrollToResource:function(e) {
            var self = $(e.currentTarget);
            $('.rab-resource-sb a').removeClass('rab-resource-sb-active');
            self.addClass('rab-resource-sb-active');
            $(window).scrollTop($(self.attr('href')).position().top + this.headerOffset);
            return false;
        },
        performCall: function(e) {
            var queryParams, jsonRpcParams, customParams, data, outputType,
                form = $(e.currentTarget),
                url = form.attr('action'),
                method = form.attr('method'),
                representation = form.find('select[name=representation]').val();

            $.each(form.find('.rab-param-style-template'), function() {
                var self = $(this), pat = new RegExp('\{' + self.attr('name') + '\:?(.*)\}', 'g');
                url = url.replace(pat, self.val());
            });

            queryParams = $.map(form.find('.rab-param-style-query'), function(e) {
                var self = $(e);
                if (self.val() !== '')
                    return self.serialize();
            });


            jsonRpcParams = [].concat($.map(form.find('.rab-param-style-jsonRpc'), function(e) {
                return $(e).val();
            }));

            customParams = $.map(form.find('.rab-custom-params'), function(e) {
                var self = $(e), paramName = self.find('.rab-param-style-custom-name').val(), paramVal = self.find('.rab-param-style-custom-value').val();
                if (paramName && paramVal)
                    return paramName + "=" + paramVal;
            });

            $.merge($.merge(queryParams, jsonRpcParams), customParams);

            if (queryParams.length > 0) {
                url += "?" + queryParams.join('&');
            }

            if (jsonRpcParams.length > 0) {
                data = JSON.stringify(jsonRpcParams);
                representation = 'application/json';
            } else if (method === "POST" || method === "PUT") {
                data = form.find('textarea').val();
                if (data.trim() === "") {
                    data = "{}";
                }
            }

            if (representation === 'application/xml') {
                outputType = 'xml';
            } else {
                outputType = 'json';
            }

            $.ajax({
                url: url,
                type: method,
                data: data,
                contentType: representation,
                dataType: outputType,
                beforeSend: function() {
                    form.find('.rab-throbber').removeClass('hidden');
                    form.find('.rab-exec').attr('disabled', 'disabled');
                },
                complete: function() {
                    form.find('.rab-throbber').addClass('hidden');
                    form.find('.rab-exec').removeAttr('disabled');
                }
            }).done(
                function(d, msg, o) {
                    var contentType, rsp = {};
                    rsp.headers = o.getAllResponseHeaders();
                    contentType = o.getResponseHeader('Content-Type');

                    if (/^application\/xml/.test(contentType)) {
                        rsp.body = o.responseText;
                    } else {
                        try {
                            rsp.body = JSON.stringify(d, null, 2);
                        } catch(e) {
                            try {
                                rsp.body = d.documentElement.innerHTML;
                            } catch(e) {
                                rsp.body = d;
                            }
                        }
                    }
                    if (rsp.body == null) rsp.body = "";
                    rsp.call = method + " " + url + " (" + o.status + ")";
                    form.next().html($('#rab-output-tmpl').tmpl(rsp));
                    prettyPrint();
                }).fail(function(o, msg, descr) {
                    var rsp = {};
                    rsp.headers = o.getAllResponseHeaders();
                    try {
                        rsp.body = JSON.stringify(JSON.parse(o.responseText), null, 2);
                    } catch(e) {
                        rsp.body = o.responseText;
                    }
                    if (rsp.body == null) rsp.body = "";
                    rsp.call = method + " " + url + " (" + o.status + ")";
                    form.next().html($('#rab-output-tmpl').tmpl(rsp));
                    prettyPrint();
                });

            return false;
        },
        clearOutput:function(e) {
            $(e.currentTarget).parent().next().empty();
            return false;
        }
    });
    var appViewController = new AppViewController();

    var AppRouter = Backbone.Router.extend({
        routes: {
            '/': 'home',
            '/:key': 'service',
            '*page': 'catchAll'
        },
        home: function() {
            new BrowserView(services.first());
        },
        service: function(key) {
            var svc = services.findByKey(key);
            if (svc) {
                new BrowserView(svc);
            } else {
                appRouter.navigate('/');
            }
        },
        catchAll: function() {
            this.navigate('/', true);
        }
    });
    var appRouter = new AppRouter();
    // Workaround to Bamboo's shitty DOMContentLoad bug
//    if ($('body#jira').length > 0 || $('body#com-atlassian-confluence').length > 0) {
//        Backbone.history.start();
//    } else {
        new BrowserView(services.first());
//    }
});