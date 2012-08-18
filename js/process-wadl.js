// **processWADL** will blow through a WADL file (specified by URL) and normalize
// it for consumption. The output is in JSON. This code is hosted at
// <https://bitbucket.org/rmanalan/process-wadl>
//
// ####Sample call:
//
//     processWADL('/rest/api/1.0/application.wadl')
//       .done(function(d) {
//         // success
//       })
//       .fail(function(d) {
//         // error
//       });
//     
function processWADL(url) {
    var debug = false,
        useNamespace = false,
    // Turn this function to a jQuery promise object
        dfd = new jQuery.Deferred();

    function addNamespace(selector){
        if (!useNamespace) return selector;
        return "ns2\\:" + selector;
    }

    // Use jQuery ajax to get WADL from a URL
    jQuery.ajax({
        url:url,
        dataType:"text xml"
    }).error(function() {
            // Reject the promise if there's an ajax error
            dfd.reject({
                error: "Something shitty happened. Sorry."
            });
        }).success(function(x) {
            // Ajax call was successful
            var outResources = [];

            // Test to see if namespace is required
            if (jQuery(x).find('resources').length === 0){
                useNamespace = true;
            }

            var base = jQuery(x).find(addNamespace('resources')).attr('base'),
                top = jQuery(x).find(addNamespace('resources')).find('>'+addNamespace('resource'));

            // Helper function for extracting the doc CDATA section from
            // a node
            function getDoc(node,html) {

                var txt,
                    html = html || false,
                    doc = node.find('>'+addNamespace('doc'));
                if (doc.length > 0) {
                    if (html) {
                        try {
                            txt = doc.contents()[0].nextSibling.innerHTML.replace(/<(\/?)([^:>]*:)?([^>]+)>/g, "<$1$3>");
                        } catch(e){
                            txt = doc.text();
                        }
                    } else {
                        txt = doc.text();
                    }
                }
                return txt || "";
            }

            // Main function to cycle through resources in the WADL. This
            // function is called recursively.
            function getResource(resource, path, resourceWideParams, obj) {
                var childResource, methodArry, path, params,
                    outMethods = [], addlPath = resource.attr('path');

                obj = obj || {};

                // Replace brackets with colon
                // addlPath = addlPath.replace(/\{/g,":").replace(/\}/g,"");

                // Check for forward slashes before concatinating
                if (/\/jQuery/g.test(path) || /^\//g.test(addlPath)) {
                    path += addlPath;
                } else {
                    path += '/' + addlPath;
                }
                path = path.replace(/\/\//g,'/');
                obj.name = path;
                obj.description = getDoc(resource);

                // Extract resource-wide params that live inside the path
                params = resource.find('>'+addNamespace('param'));
                if (params.length > 0) {
                    // Reset resource-wide params if no template params in uri
                    if (/\{/g.test(path)) {
                        resourceWideParams = [];
                    }
                    // Cycle through all resource-wide params
                    jQuery.each(params, function() {
                        var param = {},
                            self = jQuery(this);
                        param.name = self.attr('name');
                        param.description = getDoc(self);
                        param.type = self.attr('type').split(':')[1];
                        param.style = self.attr('style');
                        resourceWideParams.push(param);
                    });
                }

                // Look for methods inside resources
                methods = resource.find('>'+addNamespace('method'));
                if (methods.length > 0) {
                    // Methods found inside the resource. Extract them
                    jQuery.each(methods, function() {
                        var methodObj = {},
                            params, request, self = jQuery(this);

                        methodObj.params = [];
                        methodObj.method = self.attr('name');
                        methodObj.description = getDoc(self);
                        methodObj.uri = path;

                        // Look for params inside methods. If found
                        // extract them
                        request = self.find('>'+addNamespace('request'));
                        if (request.length > 0) {
                            // Merge resource-wide params with method params
                            jQuery.merge(methodObj.params, resourceWideParams);
                            params = request.find('>'+addNamespace('param'));
                            jQuery.each(params, function() {
                                var param = {},
                                    self = jQuery(this);
                                param.name = self.attr('name');
                                param.description = getDoc(self);
                                param.type = self.attr('type').split(':')[1];
                                param.style = self.attr('style');
                                methodObj.params.push(param);
                            });
                        } else {
                            methodObj.params = resourceWideParams;
                        }

                        response = self.find('>'+addNamespace('response'));
                        if (response.length > 0){
                            methodObj.representations = {};
                            methodObj.representations.contentTypes = jQuery.map(response.find('>'+addNamespace('representation')+'[mediaType]'), function(n){
                                return jQuery(n).attr('mediaType');
                            });
                            methodObj.representations.responses = {};
                            jQuery.map(response.find('>'+addNamespace('representation')), function(n){
                                methodObj.representations.responses[jQuery(n).attr('status')] = getDoc(jQuery(n),true);
                            });
                        }

                        outMethods.push(methodObj);
                    });

                    // Loop through additional child resources
                    childResource = resource.find('>'+addNamespace('resource'));
                    jQuery.each(childResource, function() {
                        var self = jQuery(this);
                        getResource(self, path, resourceWideParams);
                    });

                    // Attach methods inside of resource object
                    obj.methods = outMethods;

                    // Append to master resource array
                    outResources.push(obj);

                    if (debug) {
                        // Debug messages
                        methodsArry = jQuery.map(methods, function(i, e) {
                            return jQuery(i).attr('name')
                        });
                        methodsArry.length === 0 || console.log(path, methodsArry, obj, resource[0]);
                    }

                } else {
                    // No methods found inside this resource.
                    // Loop through additional child resources
                    childResource = resource.find('>'+addNamespace('resource'));
                    jQuery.each(childResource, function() {
                        var self = jQuery(this);
                        getResource(self, path, resourceWideParams);
                    });
                }

            }

            // Loop through the top level resources
            jQuery.each(top, function() {
                var self = jQuery(this);
                getResource(self, '', []);
            });

            // Resolve the promise with the resources found
            dfd.resolve({
                resources: outResources.sort(function(x,y){return (x.name < y.name)? -1: 1})
            });

        });

    // Return the promise object
    return dfd.promise();
}

