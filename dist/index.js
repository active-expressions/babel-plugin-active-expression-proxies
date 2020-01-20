'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function (_ref) {
  var t = _ref.types,
      template = _ref.template,
      traverse = _ref.traverse;


  var GENERATED_IMPORT_IDENTIFIER = Symbol("generated import identifier");

  function addCustomTemplate(file, name) {
    var declar = file.declarations[name];
    if (declar) return declar;

    var identifier = file.declarations[name] = file.addImport("active-expression-proxies", name, name);
    identifier[GENERATED_IMPORT_IDENTIFIER] = true;
    identifier[FLAG_SHOULD_NOT_REWRITE_IDENTIFIER] = true;
    return identifier;
  }

  return {
    visitor: {
      Program: {
        enter: function enter(path, state) {
          function hasDirective(path, name) {
            var foundDirective = false;
            path.traverse({
              Directive: function Directive(path) {
                if (path.get("value").node.value === name) {
                  foundDirective = true;
                }
              }
            });
            return foundDirective;
          }

          function shouldTransform() {
            var proxyDirective = hasDirective(path, 'use proxies for aexprs');
            var proxyPreference = true;
            var inWorkspace = state.opts.executedIn === 'workspace';
            var inFile = state.opts.executedIn === 'file';

            if (inWorkspace) {
              return proxyPreference;
            } else if (inFile) {
              return proxyDirective;
            }
            return true;
            // throw new Error('This should not be possible');
          }

          if (!shouldTransform()) {
            return;
          }

          function replaceNode(path, wrapType) {
            var unwrap = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

            // do not wrap the same object twice
            if (path.node.__already_transformed__) {
              return;
            }
            path.node.__already_transformed__ = true;

            var transformed = void 0;
            if (unwrap) {
              transformed = t.callExpression(addCustomTemplate(state.file, 'unwrap'), [path.node]);
            } else {
              transformed = t.callExpression(addCustomTemplate(state.file, 'wrap'), [t.stringLiteral(wrapType), path.node]);
            }
            path.replaceWith(transformed);
          }

          path.traverse({
            ObjectExpression: function ObjectExpression(path) {
              // do not replace objects in calls to Object.defineProperty
              try {
                if (path.parent.callee.property.name === "defineProperty") {
                  return;
                }
              } catch (e) {
                // Once we can use the new ecma script2020 syntax this try-catch can be replaced by optional chaining
                // https://iolap.com/2019/09/27/whats-next-for-javascript-top-5-new-features-for-2020/
              }
              replaceNode(path, 'Object');
            },
            CallExpression: function CallExpression(path) {
              // unwrap proxies in Object.defineProperty 
              try {
                if (path.node.callee.property.name === "defineProperty" && path.node.arguments[2].type === "Identifier") {
                  path.node.arguments[2].__should_unwrap__ = true;
                }
              } catch (e) {
                // Once we can use the new ecma script2020 syntax this try-catch can be replaced by optional chaining
                // https://iolap.com/2019/09/27/whats-next-for-javascript-top-5-new-features-for-2020/
              }
            },
            NewExpression: function NewExpression(path) {

              replaceNode(path, path.node.callee.name);
            },
            ArrayExpression: function ArrayExpression(path) {
              replaceNode(path, 'Array');
            },
            Identifier: function Identifier(path) {
              console.log(path.node.name);
              if (path.node[FLAG_SHOULD_NOT_REWRITE_IDENTIFIER]) {
                return;
              }

              // Check for a call to undeclared aexpr:
              if (t.isCallExpression(path.parent) && path.node.name === AEXPR_IDENTIFIER_NAME && !path.scope.hasBinding(AEXPR_IDENTIFIER_NAME)) {
                //logIdentifier("call to aexpr", path);
                path.replaceWith(addCustomTemplate(state.file, AEXPR_IDENTIFIER_NAME));
                return;
              }

              try {
                if (path.parent.callee.property.name === "defineProperty" && path.parent.arguments[2] === path.node) {
                  replaceNode(path, 'Proxy', true);
                }
              } catch (e) {
                // Once we can use the new ecma script2020 syntax this try-catch can be replaced by optional chaining
                // https://iolap.com/2019/09/27/whats-next-for-javascript-top-5-new-features-for-2020/
              }
            }
          });
        }
      }
    }
  };
};

var AEXPR_IDENTIFIER_NAME = 'aexpr';
var FLAG_SHOULD_NOT_REWRITE_IDENTIFIER = Symbol('FLAG: should not rewrite identifier');