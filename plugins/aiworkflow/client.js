// 由 scripts/build-plugin.mjs 生成，勿手改。源码见 src/。
window.__ModuleLoader__.load({
  id: "@aiworkflow/dsh-plugin",
  factory(require) {
    var module = { exports: {} };
    var exports = module.exports;
    (function (module, exports, require) {
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
let react = require("react");
react = __toESM(react, 1);
require("react-dom");
//#region
var message = null;
var tone = "error";
var infoTimer = null;
var listeners$2 = /* @__PURE__ */ new Set();
function reportError(label, error) {
	message = `${label}：${error instanceof Error ? error.message : String(error)}`;
	tone = "error";
	for (const listener of listeners$2) listener();
	console.error("[aiworkflow]", label, error);
}
/** 短暂信息条：用于确认某个页面到底有没有挂载 */
function reportInfo(text) {
	message = text;
	tone = "info";
	for (const listener of listeners$2) listener();
	if (infoTimer !== null) clearTimeout(infoTimer);
	infoTimer = setTimeout(() => {
		infoTimer = null;
		message = null;
		for (const listener of listeners$2) listener();
	}, 6e3);
}
function subscribe(listener) {
	listeners$2.add(listener);
	return () => listeners$2.delete(listener);
}
function snapshot() {
	return message;
}
/** 渲染兜底：插件页面抛错时显示原因与组件栈，而不是留一块黑屏。 */
var Boundary = class extends react.Component {
	state = {
		error: null,
		stack: null
	};
	static getDerivedStateFromError(error) {
		return { error };
	}
	componentDidCatch(error, info) {
		console.error("[aiworkflow] render error", error, info.componentStack);
		this.setState({ stack: info.componentStack ?? null });
	}
	render() {
		const { error, stack } = this.state;
		if (error === null) return this.props.children;
		return /* @__PURE__ */ react.createElement("div", {
			style: {
				padding: 16,
				overflow: "auto",
				height: "100%",
				boxSizing: "border-box",
				color: "var(--dsw-alias-state-error-primary)",
				font: "12px/1.5 ui-monospace, Menlo, monospace",
				whiteSpace: "pre-wrap"
			},
			role: "alert"
		}, /* @__PURE__ */ react.createElement("div", { style: {
			fontWeight: 700,
			marginBottom: 6
		} }, "aiworkflow ", this.props.label ?? "页面", "渲染失败"), /* @__PURE__ */ react.createElement("div", null, error.message), stack !== null && /* @__PURE__ */ react.createElement("div", { style: {
			opacity: .75,
			marginTop: 8
		} }, stack.slice(0, 1200)));
	}
};
function Diagnostics() {
	const text = react.useSyncExternalStore(subscribe, snapshot);
	if (text === null) return null;
	return /* @__PURE__ */ react.createElement("div", {
		style: {
			position: "fixed",
			left: "50%",
			bottom: 24,
			transform: "translateX(-50%)",
			maxWidth: 560,
			padding: "10px 12px",
			borderRadius: 10,
			background: "var(--dsw-alias-bg-overlay)",
			color: tone === "error" ? "var(--dsw-alias-state-error-primary)" : "var(--dsw-alias-state-success-primary)",
			border: `1px solid ${tone === "error" ? "var(--dsw-alias-state-error-primary)" : "var(--dsw-alias-state-success-primary)"}`,
			font: "12px/1.45 ui-monospace, Menlo, monospace",
			pointerEvents: "auto",
			zIndex: 80,
			whiteSpace: "pre-wrap"
		},
		role: "alert"
	}, "aiworkflow 插件：", text);
}
//#endregion
//#region
var Fragment = react.Fragment;
function jsx(type, props, key) {
	return react.createElement(type, key === void 0 ? props : {
		...props,
		key
	}, props.children);
}
var jsxs = jsx;
//#endregion
//#region
function cc(names) {
	if (typeof names === "string" || typeof names === "number") return "" + names;
	let out = "";
	if (Array.isArray(names)) {
		for (let i = 0, tmp; i < names.length; i++) if ((tmp = cc(names[i])) !== "") out += (out && " ") + tmp;
	} else for (let k in names) if (names[k]) out += (out && " ") + k;
	return out;
}
//#endregion
//#region
var noop = { value: () => {} };
function dispatch() {
	for (var i = 0, n = arguments.length, _ = {}, t; i < n; ++i) {
		if (!(t = arguments[i] + "") || t in _ || /[\s.]/.test(t)) throw new Error("illegal type: " + t);
		_[t] = [];
	}
	return new Dispatch(_);
}
function Dispatch(_) {
	this._ = _;
}
function parseTypenames$1(typenames, types) {
	return typenames.trim().split(/^|\s+/).map(function(t) {
		var name = "", i = t.indexOf(".");
		if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
		if (t && !types.hasOwnProperty(t)) throw new Error("unknown type: " + t);
		return {
			type: t,
			name
		};
	});
}
Dispatch.prototype = dispatch.prototype = {
	constructor: Dispatch,
	on: function(typename, callback) {
		var _ = this._, T = parseTypenames$1(typename + "", _), t, i = -1, n = T.length;
		if (arguments.length < 2) {
			while (++i < n) if ((t = (typename = T[i]).type) && (t = get$1(_[t], typename.name))) return t;
			return;
		}
		if (callback != null && typeof callback !== "function") throw new Error("invalid callback: " + callback);
		while (++i < n) if (t = (typename = T[i]).type) _[t] = set$1(_[t], typename.name, callback);
		else if (callback == null) for (t in _) _[t] = set$1(_[t], typename.name, null);
		return this;
	},
	copy: function() {
		var copy = {}, _ = this._;
		for (var t in _) copy[t] = _[t].slice();
		return new Dispatch(copy);
	},
	call: function(type, that) {
		if ((n = arguments.length - 2) > 0) for (var args = new Array(n), i = 0, n, t; i < n; ++i) args[i] = arguments[i + 2];
		if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
		for (t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
	},
	apply: function(type, that, args) {
		if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
		for (var t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
	}
};
function get$1(type, name) {
	for (var i = 0, n = type.length, c; i < n; ++i) if ((c = type[i]).name === name) return c.value;
}
function set$1(type, name, callback) {
	for (var i = 0, n = type.length; i < n; ++i) if (type[i].name === name) {
		type[i] = noop, type = type.slice(0, i).concat(type.slice(i + 1));
		break;
	}
	if (callback != null) type.push({
		name,
		value: callback
	});
	return type;
}
var namespaces_default = {
	svg: "http://www.w3.org/2000/svg",
	xhtml: "http://www.w3.org/1999/xhtml",
	xlink: "http://www.w3.org/1999/xlink",
	xml: "http://www.w3.org/XML/1998/namespace",
	xmlns: "http://www.w3.org/2000/xmlns/"
};
//#endregion
//#region
function namespace_default(name) {
	var prefix = name += "", i = prefix.indexOf(":");
	if (i >= 0 && (prefix = name.slice(0, i)) !== "xmlns") name = name.slice(i + 1);
	return namespaces_default.hasOwnProperty(prefix) ? {
		space: namespaces_default[prefix],
		local: name
	} : name;
}
//#endregion
//#region
function creatorInherit(name) {
	return function() {
		var document = this.ownerDocument, uri = this.namespaceURI;
		return uri === "http://www.w3.org/1999/xhtml" && document.documentElement.namespaceURI === "http://www.w3.org/1999/xhtml" ? document.createElement(name) : document.createElementNS(uri, name);
	};
}
function creatorFixed(fullname) {
	return function() {
		return this.ownerDocument.createElementNS(fullname.space, fullname.local);
	};
}
function creator_default(name) {
	var fullname = namespace_default(name);
	return (fullname.local ? creatorFixed : creatorInherit)(fullname);
}
//#endregion
//#region
function none() {}
function selector_default(selector) {
	return selector == null ? none : function() {
		return this.querySelector(selector);
	};
}
//#endregion
//#region
function select_default$2(select) {
	if (typeof select !== "function") select = selector_default(select);
	for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) if ((node = group[i]) && (subnode = select.call(node, node.__data__, i, group))) {
		if ("__data__" in node) subnode.__data__ = node.__data__;
		subgroup[i] = subnode;
	}
	return new Selection$1(subgroups, this._parents);
}
//#endregion
//#region
function array(x) {
	return x == null ? [] : Array.isArray(x) ? x : Array.from(x);
}
//#endregion
//#region
function empty() {
	return [];
}
function selectorAll_default(selector) {
	return selector == null ? empty : function() {
		return this.querySelectorAll(selector);
	};
}
//#endregion
//#region
function arrayAll(select) {
	return function() {
		return array(select.apply(this, arguments));
	};
}
function selectAll_default$1(select) {
	if (typeof select === "function") select = arrayAll(select);
	else select = selectorAll_default(select);
	for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) if (node = group[i]) {
		subgroups.push(select.call(node, node.__data__, i, group));
		parents.push(node);
	}
	return new Selection$1(subgroups, parents);
}
//#endregion
//#region
function matcher_default(selector) {
	return function() {
		return this.matches(selector);
	};
}
function childMatcher(selector) {
	return function(node) {
		return node.matches(selector);
	};
}
//#endregion
//#region
var find = Array.prototype.find;
function childFind(match) {
	return function() {
		return find.call(this.children, match);
	};
}
function childFirst() {
	return this.firstElementChild;
}
function selectChild_default(match) {
	return this.select(match == null ? childFirst : childFind(typeof match === "function" ? match : childMatcher(match)));
}
//#endregion
//#region
var filter = Array.prototype.filter;
function children() {
	return Array.from(this.children);
}
function childrenFilter(match) {
	return function() {
		return filter.call(this.children, match);
	};
}
function selectChildren_default(match) {
	return this.selectAll(match == null ? children : childrenFilter(typeof match === "function" ? match : childMatcher(match)));
}
//#endregion
//#region
function filter_default$1(match) {
	if (typeof match !== "function") match = matcher_default(match);
	for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) if ((node = group[i]) && match.call(node, node.__data__, i, group)) subgroup.push(node);
	return new Selection$1(subgroups, this._parents);
}
//#endregion
//#region
function sparse_default(update) {
	return new Array(update.length);
}
//#endregion
//#region
function enter_default() {
	return new Selection$1(this._enter || this._groups.map(sparse_default), this._parents);
}
function EnterNode(parent, datum) {
	this.ownerDocument = parent.ownerDocument;
	this.namespaceURI = parent.namespaceURI;
	this._next = null;
	this._parent = parent;
	this.__data__ = datum;
}
EnterNode.prototype = {
	constructor: EnterNode,
	appendChild: function(child) {
		return this._parent.insertBefore(child, this._next);
	},
	insertBefore: function(child, next) {
		return this._parent.insertBefore(child, next);
	},
	querySelector: function(selector) {
		return this._parent.querySelector(selector);
	},
	querySelectorAll: function(selector) {
		return this._parent.querySelectorAll(selector);
	}
};
//#endregion
//#region
function constant_default$3(x) {
	return function() {
		return x;
	};
}
//#endregion
//#region
function bindIndex(parent, group, enter, update, exit, data) {
	var i = 0, node, groupLength = group.length, dataLength = data.length;
	for (; i < dataLength; ++i) if (node = group[i]) {
		node.__data__ = data[i];
		update[i] = node;
	} else enter[i] = new EnterNode(parent, data[i]);
	for (; i < groupLength; ++i) if (node = group[i]) exit[i] = node;
}
function bindKey(parent, group, enter, update, exit, data, key) {
	var i, node, nodeByKeyValue = /* @__PURE__ */ new Map(), groupLength = group.length, dataLength = data.length, keyValues = new Array(groupLength), keyValue;
	for (i = 0; i < groupLength; ++i) if (node = group[i]) {
		keyValues[i] = keyValue = key.call(node, node.__data__, i, group) + "";
		if (nodeByKeyValue.has(keyValue)) exit[i] = node;
		else nodeByKeyValue.set(keyValue, node);
	}
	for (i = 0; i < dataLength; ++i) {
		keyValue = key.call(parent, data[i], i, data) + "";
		if (node = nodeByKeyValue.get(keyValue)) {
			update[i] = node;
			node.__data__ = data[i];
			nodeByKeyValue.delete(keyValue);
		} else enter[i] = new EnterNode(parent, data[i]);
	}
	for (i = 0; i < groupLength; ++i) if ((node = group[i]) && nodeByKeyValue.get(keyValues[i]) === node) exit[i] = node;
}
function datum(node) {
	return node.__data__;
}
function data_default(value, key) {
	if (!arguments.length) return Array.from(this, datum);
	var bind = key ? bindKey : bindIndex, parents = this._parents, groups = this._groups;
	if (typeof value !== "function") value = constant_default$3(value);
	for (var m = groups.length, update = new Array(m), enter = new Array(m), exit = new Array(m), j = 0; j < m; ++j) {
		var parent = parents[j], group = groups[j], groupLength = group.length, data = arraylike(value.call(parent, parent && parent.__data__, j, parents)), dataLength = data.length, enterGroup = enter[j] = new Array(dataLength), updateGroup = update[j] = new Array(dataLength);
		bind(parent, group, enterGroup, updateGroup, exit[j] = new Array(groupLength), data, key);
		for (var i0 = 0, i1 = 0, previous, next; i0 < dataLength; ++i0) if (previous = enterGroup[i0]) {
			if (i0 >= i1) i1 = i0 + 1;
			while (!(next = updateGroup[i1]) && ++i1 < dataLength);
			previous._next = next || null;
		}
	}
	update = new Selection$1(update, parents);
	update._enter = enter;
	update._exit = exit;
	return update;
}
function arraylike(data) {
	return typeof data === "object" && "length" in data ? data : Array.from(data);
}
//#endregion
//#region
function exit_default() {
	return new Selection$1(this._exit || this._groups.map(sparse_default), this._parents);
}
//#endregion
//#region
function join_default(onenter, onupdate, onexit) {
	var enter = this.enter(), update = this, exit = this.exit();
	if (typeof onenter === "function") {
		enter = onenter(enter);
		if (enter) enter = enter.selection();
	} else enter = enter.append(onenter + "");
	if (onupdate != null) {
		update = onupdate(update);
		if (update) update = update.selection();
	}
	if (onexit == null) exit.remove();
	else onexit(exit);
	return enter && update ? enter.merge(update).order() : update;
}
//#endregion
//#region
function merge_default$1(context) {
	var selection = context.selection ? context.selection() : context;
	for (var groups0 = this._groups, groups1 = selection._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) if (node = group0[i] || group1[i]) merge[i] = node;
	for (; j < m0; ++j) merges[j] = groups0[j];
	return new Selection$1(merges, this._parents);
}
//#endregion
//#region
function order_default() {
	for (var groups = this._groups, j = -1, m = groups.length; ++j < m;) for (var group = groups[j], i = group.length - 1, next = group[i], node; --i >= 0;) if (node = group[i]) {
		if (next && node.compareDocumentPosition(next) ^ 4) next.parentNode.insertBefore(node, next);
		next = node;
	}
	return this;
}
//#endregion
//#region
function sort_default(compare) {
	if (!compare) compare = ascending;
	function compareNode(a, b) {
		return a && b ? compare(a.__data__, b.__data__) : !a - !b;
	}
	for (var groups = this._groups, m = groups.length, sortgroups = new Array(m), j = 0; j < m; ++j) {
		for (var group = groups[j], n = group.length, sortgroup = sortgroups[j] = new Array(n), node, i = 0; i < n; ++i) if (node = group[i]) sortgroup[i] = node;
		sortgroup.sort(compareNode);
	}
	return new Selection$1(sortgroups, this._parents).order();
}
function ascending(a, b) {
	return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
}
//#endregion
//#region
function call_default() {
	var callback = arguments[0];
	arguments[0] = this;
	callback.apply(null, arguments);
	return this;
}
//#endregion
//#region
function nodes_default() {
	return Array.from(this);
}
//#endregion
//#region
function node_default() {
	for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) for (var group = groups[j], i = 0, n = group.length; i < n; ++i) {
		var node = group[i];
		if (node) return node;
	}
	return null;
}
//#endregion
//#region
function size_default() {
	let size = 0;
	for (const node of this) ++size;
	return size;
}
//#endregion
//#region
function empty_default() {
	return !this.node();
}
//#endregion
//#region
function each_default(callback) {
	for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) for (var group = groups[j], i = 0, n = group.length, node; i < n; ++i) if (node = group[i]) callback.call(node, node.__data__, i, group);
	return this;
}
//#endregion
//#region
function attrRemove$1(name) {
	return function() {
		this.removeAttribute(name);
	};
}
function attrRemoveNS$1(fullname) {
	return function() {
		this.removeAttributeNS(fullname.space, fullname.local);
	};
}
function attrConstant$1(name, value) {
	return function() {
		this.setAttribute(name, value);
	};
}
function attrConstantNS$1(fullname, value) {
	return function() {
		this.setAttributeNS(fullname.space, fullname.local, value);
	};
}
function attrFunction$1(name, value) {
	return function() {
		var v = value.apply(this, arguments);
		if (v == null) this.removeAttribute(name);
		else this.setAttribute(name, v);
	};
}
function attrFunctionNS$1(fullname, value) {
	return function() {
		var v = value.apply(this, arguments);
		if (v == null) this.removeAttributeNS(fullname.space, fullname.local);
		else this.setAttributeNS(fullname.space, fullname.local, v);
	};
}
function attr_default$1(name, value) {
	var fullname = namespace_default(name);
	if (arguments.length < 2) {
		var node = this.node();
		return fullname.local ? node.getAttributeNS(fullname.space, fullname.local) : node.getAttribute(fullname);
	}
	return this.each((value == null ? fullname.local ? attrRemoveNS$1 : attrRemove$1 : typeof value === "function" ? fullname.local ? attrFunctionNS$1 : attrFunction$1 : fullname.local ? attrConstantNS$1 : attrConstant$1)(fullname, value));
}
//#endregion
//#region
function window_default(node) {
	return node.ownerDocument && node.ownerDocument.defaultView || node.document && node || node.defaultView;
}
//#endregion
//#region
function styleRemove$1(name) {
	return function() {
		this.style.removeProperty(name);
	};
}
function styleConstant$1(name, value, priority) {
	return function() {
		this.style.setProperty(name, value, priority);
	};
}
function styleFunction$1(name, value, priority) {
	return function() {
		var v = value.apply(this, arguments);
		if (v == null) this.style.removeProperty(name);
		else this.style.setProperty(name, v, priority);
	};
}
function style_default$2(name, value, priority) {
	return arguments.length > 1 ? this.each((value == null ? styleRemove$1 : typeof value === "function" ? styleFunction$1 : styleConstant$1)(name, value, priority == null ? "" : priority)) : styleValue(this.node(), name);
}
function styleValue(node, name) {
	return node.style.getPropertyValue(name) || window_default(node).getComputedStyle(node, null).getPropertyValue(name);
}
//#endregion
//#region
function propertyRemove(name) {
	return function() {
		delete this[name];
	};
}
function propertyConstant(name, value) {
	return function() {
		this[name] = value;
	};
}
function propertyFunction(name, value) {
	return function() {
		var v = value.apply(this, arguments);
		if (v == null) delete this[name];
		else this[name] = v;
	};
}
function property_default(name, value) {
	return arguments.length > 1 ? this.each((value == null ? propertyRemove : typeof value === "function" ? propertyFunction : propertyConstant)(name, value)) : this.node()[name];
}
//#endregion
//#region
function classArray(string) {
	return string.trim().split(/^|\s+/);
}
function classList(node) {
	return node.classList || new ClassList(node);
}
function ClassList(node) {
	this._node = node;
	this._names = classArray(node.getAttribute("class") || "");
}
ClassList.prototype = {
	add: function(name) {
		if (this._names.indexOf(name) < 0) {
			this._names.push(name);
			this._node.setAttribute("class", this._names.join(" "));
		}
	},
	remove: function(name) {
		var i = this._names.indexOf(name);
		if (i >= 0) {
			this._names.splice(i, 1);
			this._node.setAttribute("class", this._names.join(" "));
		}
	},
	contains: function(name) {
		return this._names.indexOf(name) >= 0;
	}
};
function classedAdd(node, names) {
	var list = classList(node), i = -1, n = names.length;
	while (++i < n) list.add(names[i]);
}
function classedRemove(node, names) {
	var list = classList(node), i = -1, n = names.length;
	while (++i < n) list.remove(names[i]);
}
function classedTrue(names) {
	return function() {
		classedAdd(this, names);
	};
}
function classedFalse(names) {
	return function() {
		classedRemove(this, names);
	};
}
function classedFunction(names, value) {
	return function() {
		(value.apply(this, arguments) ? classedAdd : classedRemove)(this, names);
	};
}
function classed_default(name, value) {
	var names = classArray(name + "");
	if (arguments.length < 2) {
		var list = classList(this.node()), i = -1, n = names.length;
		while (++i < n) if (!list.contains(names[i])) return false;
		return true;
	}
	return this.each((typeof value === "function" ? classedFunction : value ? classedTrue : classedFalse)(names, value));
}
//#endregion
//#region
function textRemove() {
	this.textContent = "";
}
function textConstant$1(value) {
	return function() {
		this.textContent = value;
	};
}
function textFunction$1(value) {
	return function() {
		var v = value.apply(this, arguments);
		this.textContent = v == null ? "" : v;
	};
}
function text_default$1(value) {
	return arguments.length ? this.each(value == null ? textRemove : (typeof value === "function" ? textFunction$1 : textConstant$1)(value)) : this.node().textContent;
}
//#endregion
//#region
function htmlRemove() {
	this.innerHTML = "";
}
function htmlConstant(value) {
	return function() {
		this.innerHTML = value;
	};
}
function htmlFunction(value) {
	return function() {
		var v = value.apply(this, arguments);
		this.innerHTML = v == null ? "" : v;
	};
}
function html_default(value) {
	return arguments.length ? this.each(value == null ? htmlRemove : (typeof value === "function" ? htmlFunction : htmlConstant)(value)) : this.node().innerHTML;
}
//#endregion
//#region
function raise() {
	if (this.nextSibling) this.parentNode.appendChild(this);
}
function raise_default() {
	return this.each(raise);
}
//#endregion
//#region
function lower() {
	if (this.previousSibling) this.parentNode.insertBefore(this, this.parentNode.firstChild);
}
function lower_default() {
	return this.each(lower);
}
//#endregion
//#region
function append_default(name) {
	var create = typeof name === "function" ? name : creator_default(name);
	return this.select(function() {
		return this.appendChild(create.apply(this, arguments));
	});
}
//#endregion
//#region
function constantNull() {
	return null;
}
function insert_default(name, before) {
	var create = typeof name === "function" ? name : creator_default(name), select = before == null ? constantNull : typeof before === "function" ? before : selector_default(before);
	return this.select(function() {
		return this.insertBefore(create.apply(this, arguments), select.apply(this, arguments) || null);
	});
}
//#endregion
//#region
function remove() {
	var parent = this.parentNode;
	if (parent) parent.removeChild(this);
}
function remove_default$1() {
	return this.each(remove);
}
//#endregion
//#region
function selection_cloneShallow() {
	var clone = this.cloneNode(false), parent = this.parentNode;
	return parent ? parent.insertBefore(clone, this.nextSibling) : clone;
}
function selection_cloneDeep() {
	var clone = this.cloneNode(true), parent = this.parentNode;
	return parent ? parent.insertBefore(clone, this.nextSibling) : clone;
}
function clone_default(deep) {
	return this.select(deep ? selection_cloneDeep : selection_cloneShallow);
}
//#endregion
//#region
function datum_default(value) {
	return arguments.length ? this.property("__data__", value) : this.node().__data__;
}
//#endregion
//#region
function contextListener(listener) {
	return function(event) {
		listener.call(this, event, this.__data__);
	};
}
function parseTypenames(typenames) {
	return typenames.trim().split(/^|\s+/).map(function(t) {
		var name = "", i = t.indexOf(".");
		if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
		return {
			type: t,
			name
		};
	});
}
function onRemove(typename) {
	return function() {
		var on = this.__on;
		if (!on) return;
		for (var j = 0, i = -1, m = on.length, o; j < m; ++j) if (o = on[j], (!typename.type || o.type === typename.type) && o.name === typename.name) this.removeEventListener(o.type, o.listener, o.options);
		else on[++i] = o;
		if (++i) on.length = i;
		else delete this.__on;
	};
}
function onAdd(typename, value, options) {
	return function() {
		var on = this.__on, o, listener = contextListener(value);
		if (on) {
			for (var j = 0, m = on.length; j < m; ++j) if ((o = on[j]).type === typename.type && o.name === typename.name) {
				this.removeEventListener(o.type, o.listener, o.options);
				this.addEventListener(o.type, o.listener = listener, o.options = options);
				o.value = value;
				return;
			}
		}
		this.addEventListener(typename.type, listener, options);
		o = {
			type: typename.type,
			name: typename.name,
			value,
			listener,
			options
		};
		if (!on) this.__on = [o];
		else on.push(o);
	};
}
function on_default$1(typename, value, options) {
	var typenames = parseTypenames(typename + ""), i, n = typenames.length, t;
	if (arguments.length < 2) {
		var on = this.node().__on;
		if (on) {
			for (var j = 0, m = on.length, o; j < m; ++j) for (i = 0, o = on[j]; i < n; ++i) if ((t = typenames[i]).type === o.type && t.name === o.name) return o.value;
		}
		return;
	}
	on = value ? onAdd : onRemove;
	for (i = 0; i < n; ++i) this.each(on(typenames[i], value, options));
	return this;
}
//#endregion
//#region
function dispatchEvent(node, type, params) {
	var window = window_default(node), event = window.CustomEvent;
	if (typeof event === "function") event = new event(type, params);
	else {
		event = window.document.createEvent("Event");
		if (params) event.initEvent(type, params.bubbles, params.cancelable), event.detail = params.detail;
		else event.initEvent(type, false, false);
	}
	node.dispatchEvent(event);
}
function dispatchConstant(type, params) {
	return function() {
		return dispatchEvent(this, type, params);
	};
}
function dispatchFunction(type, params) {
	return function() {
		return dispatchEvent(this, type, params.apply(this, arguments));
	};
}
function dispatch_default(type, params) {
	return this.each((typeof params === "function" ? dispatchFunction : dispatchConstant)(type, params));
}
//#endregion
//#region
function* iterator_default() {
	for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) for (var group = groups[j], i = 0, n = group.length, node; i < n; ++i) if (node = group[i]) yield node;
}
//#endregion
//#region
var root = [null];
function Selection$1(groups, parents) {
	this._groups = groups;
	this._parents = parents;
}
function selection() {
	return new Selection$1([[document.documentElement]], root);
}
function selection_selection() {
	return this;
}
Selection$1.prototype = selection.prototype = {
	constructor: Selection$1,
	select: select_default$2,
	selectAll: selectAll_default$1,
	selectChild: selectChild_default,
	selectChildren: selectChildren_default,
	filter: filter_default$1,
	data: data_default,
	enter: enter_default,
	exit: exit_default,
	join: join_default,
	merge: merge_default$1,
	selection: selection_selection,
	order: order_default,
	sort: sort_default,
	call: call_default,
	nodes: nodes_default,
	node: node_default,
	size: size_default,
	empty: empty_default,
	each: each_default,
	attr: attr_default$1,
	style: style_default$2,
	property: property_default,
	classed: classed_default,
	text: text_default$1,
	html: html_default,
	raise: raise_default,
	lower: lower_default,
	append: append_default,
	insert: insert_default,
	remove: remove_default$1,
	clone: clone_default,
	datum: datum_default,
	on: on_default$1,
	dispatch: dispatch_default,
	[Symbol.iterator]: iterator_default
};
//#endregion
//#region
function select_default$1(selector) {
	return typeof selector === "string" ? new Selection$1([[document.querySelector(selector)]], [document.documentElement]) : new Selection$1([[selector]], root);
}
//#endregion
//#region
function sourceEvent_default(event) {
	let sourceEvent;
	while (sourceEvent = event.sourceEvent) event = sourceEvent;
	return event;
}
//#endregion
//#region
function pointer_default(event, node) {
	event = sourceEvent_default(event);
	if (node === void 0) node = event.currentTarget;
	if (node) {
		var svg = node.ownerSVGElement || node;
		if (svg.createSVGPoint) {
			var point = svg.createSVGPoint();
			point.x = event.clientX, point.y = event.clientY;
			point = point.matrixTransform(node.getScreenCTM().inverse());
			return [point.x, point.y];
		}
		if (node.getBoundingClientRect) {
			var rect = node.getBoundingClientRect();
			return [event.clientX - rect.left - node.clientLeft, event.clientY - rect.top - node.clientTop];
		}
	}
	return [event.pageX, event.pageY];
}
//#endregion
//#region
var nonpassive = { passive: false };
var nonpassivecapture = {
	capture: true,
	passive: false
};
function nopropagation$1(event) {
	event.stopImmediatePropagation();
}
function noevent_default$1(event) {
	event.preventDefault();
	event.stopImmediatePropagation();
}
//#endregion
//#region
function nodrag_default(view) {
	var root = view.document.documentElement, selection = select_default$1(view).on("dragstart.drag", noevent_default$1, nonpassivecapture);
	if ("onselectstart" in root) selection.on("selectstart.drag", noevent_default$1, nonpassivecapture);
	else {
		root.__noselect = root.style.MozUserSelect;
		root.style.MozUserSelect = "none";
	}
}
function yesdrag(view, noclick) {
	var root = view.document.documentElement, selection = select_default$1(view).on("dragstart.drag", null);
	if (noclick) {
		selection.on("click.drag", noevent_default$1, nonpassivecapture);
		setTimeout(function() {
			selection.on("click.drag", null);
		}, 0);
	}
	if ("onselectstart" in root) selection.on("selectstart.drag", null);
	else {
		root.style.MozUserSelect = root.__noselect;
		delete root.__noselect;
	}
}
//#endregion
//#region
var constant_default$2 = (x) => () => x;
//#endregion
//#region
function DragEvent(type, { sourceEvent, subject, target, identifier, active, x, y, dx, dy, dispatch }) {
	Object.defineProperties(this, {
		type: {
			value: type,
			enumerable: true,
			configurable: true
		},
		sourceEvent: {
			value: sourceEvent,
			enumerable: true,
			configurable: true
		},
		subject: {
			value: subject,
			enumerable: true,
			configurable: true
		},
		target: {
			value: target,
			enumerable: true,
			configurable: true
		},
		identifier: {
			value: identifier,
			enumerable: true,
			configurable: true
		},
		active: {
			value: active,
			enumerable: true,
			configurable: true
		},
		x: {
			value: x,
			enumerable: true,
			configurable: true
		},
		y: {
			value: y,
			enumerable: true,
			configurable: true
		},
		dx: {
			value: dx,
			enumerable: true,
			configurable: true
		},
		dy: {
			value: dy,
			enumerable: true,
			configurable: true
		},
		_: { value: dispatch }
	});
}
DragEvent.prototype.on = function() {
	var value = this._.on.apply(this._, arguments);
	return value === this._ ? this : value;
};
//#endregion
//#region
function defaultFilter$1(event) {
	return !event.ctrlKey && !event.button;
}
function defaultContainer() {
	return this.parentNode;
}
function defaultSubject(event, d) {
	return d == null ? {
		x: event.x,
		y: event.y
	} : d;
}
function defaultTouchable$1() {
	return navigator.maxTouchPoints || "ontouchstart" in this;
}
function drag_default() {
	var filter = defaultFilter$1, container = defaultContainer, subject = defaultSubject, touchable = defaultTouchable$1, gestures = {}, listeners = dispatch("start", "drag", "end"), active = 0, mousedownx, mousedowny, mousemoving, touchending, clickDistance2 = 0;
	function drag(selection) {
		selection.on("mousedown.drag", mousedowned).filter(touchable).on("touchstart.drag", touchstarted).on("touchmove.drag", touchmoved, nonpassive).on("touchend.drag touchcancel.drag", touchended).style("touch-action", "none").style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
	}
	function mousedowned(event, d) {
		if (touchending || !filter.call(this, event, d)) return;
		var gesture = beforestart(this, container.call(this, event, d), event, d, "mouse");
		if (!gesture) return;
		select_default$1(event.view).on("mousemove.drag", mousemoved, nonpassivecapture).on("mouseup.drag", mouseupped, nonpassivecapture);
		nodrag_default(event.view);
		nopropagation$1(event);
		mousemoving = false;
		mousedownx = event.clientX;
		mousedowny = event.clientY;
		gesture("start", event);
	}
	function mousemoved(event) {
		noevent_default$1(event);
		if (!mousemoving) {
			var dx = event.clientX - mousedownx, dy = event.clientY - mousedowny;
			mousemoving = dx * dx + dy * dy > clickDistance2;
		}
		gestures.mouse("drag", event);
	}
	function mouseupped(event) {
		select_default$1(event.view).on("mousemove.drag mouseup.drag", null);
		yesdrag(event.view, mousemoving);
		noevent_default$1(event);
		gestures.mouse("end", event);
	}
	function touchstarted(event, d) {
		if (!filter.call(this, event, d)) return;
		var touches = event.changedTouches, c = container.call(this, event, d), n = touches.length, i, gesture;
		for (i = 0; i < n; ++i) if (gesture = beforestart(this, c, event, d, touches[i].identifier, touches[i])) {
			nopropagation$1(event);
			gesture("start", event, touches[i]);
		}
	}
	function touchmoved(event) {
		var touches = event.changedTouches, n = touches.length, i, gesture;
		for (i = 0; i < n; ++i) if (gesture = gestures[touches[i].identifier]) {
			noevent_default$1(event);
			gesture("drag", event, touches[i]);
		}
	}
	function touchended(event) {
		var touches = event.changedTouches, n = touches.length, i, gesture;
		if (touchending) clearTimeout(touchending);
		touchending = setTimeout(function() {
			touchending = null;
		}, 500);
		for (i = 0; i < n; ++i) if (gesture = gestures[touches[i].identifier]) {
			nopropagation$1(event);
			gesture("end", event, touches[i]);
		}
	}
	function beforestart(that, container, event, d, identifier, touch) {
		var dispatch = listeners.copy(), p = pointer_default(touch || event, container), dx, dy, s;
		if ((s = subject.call(that, new DragEvent("beforestart", {
			sourceEvent: event,
			target: drag,
			identifier,
			active,
			x: p[0],
			y: p[1],
			dx: 0,
			dy: 0,
			dispatch
		}), d)) == null) return;
		dx = s.x - p[0] || 0;
		dy = s.y - p[1] || 0;
		return function gesture(type, event, touch) {
			var p0 = p, n;
			switch (type) {
				case "start":
					gestures[identifier] = gesture, n = active++;
					break;
				case "end": delete gestures[identifier], --active;
				case "drag": p = pointer_default(touch || event, container), n = active;
			}
			dispatch.call(type, that, new DragEvent(type, {
				sourceEvent: event,
				subject: s,
				target: drag,
				identifier,
				active: n,
				x: p[0] + dx,
				y: p[1] + dy,
				dx: p[0] - p0[0],
				dy: p[1] - p0[1],
				dispatch
			}), d);
		};
	}
	drag.filter = function(_) {
		return arguments.length ? (filter = typeof _ === "function" ? _ : constant_default$2(!!_), drag) : filter;
	};
	drag.container = function(_) {
		return arguments.length ? (container = typeof _ === "function" ? _ : constant_default$2(_), drag) : container;
	};
	drag.subject = function(_) {
		return arguments.length ? (subject = typeof _ === "function" ? _ : constant_default$2(_), drag) : subject;
	};
	drag.touchable = function(_) {
		return arguments.length ? (touchable = typeof _ === "function" ? _ : constant_default$2(!!_), drag) : touchable;
	};
	drag.on = function() {
		var value = listeners.on.apply(listeners, arguments);
		return value === listeners ? drag : value;
	};
	drag.clickDistance = function(_) {
		return arguments.length ? (clickDistance2 = (_ = +_) * _, drag) : Math.sqrt(clickDistance2);
	};
	return drag;
}
//#endregion
//#region
function define_default(constructor, factory, prototype) {
	constructor.prototype = factory.prototype = prototype;
	prototype.constructor = constructor;
}
function extend(parent, definition) {
	var prototype = Object.create(parent.prototype);
	for (var key in definition) prototype[key] = definition[key];
	return prototype;
}
//#endregion
//#region
function Color() {}
var darker = .7;
var brighter = 1 / darker;
var reI = "\\s*([+-]?\\d+)\\s*";
var reN = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*";
var reP = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*";
var reHex = /^#([0-9a-f]{3,8})$/;
var reRgbInteger = new RegExp(`^rgb\\(${reI},${reI},${reI}\\)$`);
var reRgbPercent = new RegExp(`^rgb\\(${reP},${reP},${reP}\\)$`);
var reRgbaInteger = new RegExp(`^rgba\\(${reI},${reI},${reI},${reN}\\)$`);
var reRgbaPercent = new RegExp(`^rgba\\(${reP},${reP},${reP},${reN}\\)$`);
var reHslPercent = new RegExp(`^hsl\\(${reN},${reP},${reP}\\)$`);
var reHslaPercent = new RegExp(`^hsla\\(${reN},${reP},${reP},${reN}\\)$`);
var named = {
	aliceblue: 15792383,
	antiquewhite: 16444375,
	aqua: 65535,
	aquamarine: 8388564,
	azure: 15794175,
	beige: 16119260,
	bisque: 16770244,
	black: 0,
	blanchedalmond: 16772045,
	blue: 255,
	blueviolet: 9055202,
	brown: 10824234,
	burlywood: 14596231,
	cadetblue: 6266528,
	chartreuse: 8388352,
	chocolate: 13789470,
	coral: 16744272,
	cornflowerblue: 6591981,
	cornsilk: 16775388,
	crimson: 14423100,
	cyan: 65535,
	darkblue: 139,
	darkcyan: 35723,
	darkgoldenrod: 12092939,
	darkgray: 11119017,
	darkgreen: 25600,
	darkgrey: 11119017,
	darkkhaki: 12433259,
	darkmagenta: 9109643,
	darkolivegreen: 5597999,
	darkorange: 16747520,
	darkorchid: 10040012,
	darkred: 9109504,
	darksalmon: 15308410,
	darkseagreen: 9419919,
	darkslateblue: 4734347,
	darkslategray: 3100495,
	darkslategrey: 3100495,
	darkturquoise: 52945,
	darkviolet: 9699539,
	deeppink: 16716947,
	deepskyblue: 49151,
	dimgray: 6908265,
	dimgrey: 6908265,
	dodgerblue: 2003199,
	firebrick: 11674146,
	floralwhite: 16775920,
	forestgreen: 2263842,
	fuchsia: 16711935,
	gainsboro: 14474460,
	ghostwhite: 16316671,
	gold: 16766720,
	goldenrod: 14329120,
	gray: 8421504,
	green: 32768,
	greenyellow: 11403055,
	grey: 8421504,
	honeydew: 15794160,
	hotpink: 16738740,
	indianred: 13458524,
	indigo: 4915330,
	ivory: 16777200,
	khaki: 15787660,
	lavender: 15132410,
	lavenderblush: 16773365,
	lawngreen: 8190976,
	lemonchiffon: 16775885,
	lightblue: 11393254,
	lightcoral: 15761536,
	lightcyan: 14745599,
	lightgoldenrodyellow: 16448210,
	lightgray: 13882323,
	lightgreen: 9498256,
	lightgrey: 13882323,
	lightpink: 16758465,
	lightsalmon: 16752762,
	lightseagreen: 2142890,
	lightskyblue: 8900346,
	lightslategray: 7833753,
	lightslategrey: 7833753,
	lightsteelblue: 11584734,
	lightyellow: 16777184,
	lime: 65280,
	limegreen: 3329330,
	linen: 16445670,
	magenta: 16711935,
	maroon: 8388608,
	mediumaquamarine: 6737322,
	mediumblue: 205,
	mediumorchid: 12211667,
	mediumpurple: 9662683,
	mediumseagreen: 3978097,
	mediumslateblue: 8087790,
	mediumspringgreen: 64154,
	mediumturquoise: 4772300,
	mediumvioletred: 13047173,
	midnightblue: 1644912,
	mintcream: 16121850,
	mistyrose: 16770273,
	moccasin: 16770229,
	navajowhite: 16768685,
	navy: 128,
	oldlace: 16643558,
	olive: 8421376,
	olivedrab: 7048739,
	orange: 16753920,
	orangered: 16729344,
	orchid: 14315734,
	palegoldenrod: 15657130,
	palegreen: 10025880,
	paleturquoise: 11529966,
	palevioletred: 14381203,
	papayawhip: 16773077,
	peachpuff: 16767673,
	peru: 13468991,
	pink: 16761035,
	plum: 14524637,
	powderblue: 11591910,
	purple: 8388736,
	rebeccapurple: 6697881,
	red: 16711680,
	rosybrown: 12357519,
	royalblue: 4286945,
	saddlebrown: 9127187,
	salmon: 16416882,
	sandybrown: 16032864,
	seagreen: 3050327,
	seashell: 16774638,
	sienna: 10506797,
	silver: 12632256,
	skyblue: 8900331,
	slateblue: 6970061,
	slategray: 7372944,
	slategrey: 7372944,
	snow: 16775930,
	springgreen: 65407,
	steelblue: 4620980,
	tan: 13808780,
	teal: 32896,
	thistle: 14204888,
	tomato: 16737095,
	turquoise: 4251856,
	violet: 15631086,
	wheat: 16113331,
	white: 16777215,
	whitesmoke: 16119285,
	yellow: 16776960,
	yellowgreen: 10145074
};
define_default(Color, color, {
	copy(channels) {
		return Object.assign(new this.constructor(), this, channels);
	},
	displayable() {
		return this.rgb().displayable();
	},
	hex: color_formatHex,
	formatHex: color_formatHex,
	formatHex8: color_formatHex8,
	formatHsl: color_formatHsl,
	formatRgb: color_formatRgb,
	toString: color_formatRgb
});
function color_formatHex() {
	return this.rgb().formatHex();
}
function color_formatHex8() {
	return this.rgb().formatHex8();
}
function color_formatHsl() {
	return hslConvert(this).formatHsl();
}
function color_formatRgb() {
	return this.rgb().formatRgb();
}
function color(format) {
	var m, l;
	format = (format + "").trim().toLowerCase();
	return (m = reHex.exec(format)) ? (l = m[1].length, m = parseInt(m[1], 16), l === 6 ? rgbn(m) : l === 3 ? new Rgb(m >> 8 & 15 | m >> 4 & 240, m >> 4 & 15 | m & 240, (m & 15) << 4 | m & 15, 1) : l === 8 ? rgba(m >> 24 & 255, m >> 16 & 255, m >> 8 & 255, (m & 255) / 255) : l === 4 ? rgba(m >> 12 & 15 | m >> 8 & 240, m >> 8 & 15 | m >> 4 & 240, m >> 4 & 15 | m & 240, ((m & 15) << 4 | m & 15) / 255) : null) : (m = reRgbInteger.exec(format)) ? new Rgb(m[1], m[2], m[3], 1) : (m = reRgbPercent.exec(format)) ? new Rgb(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, 1) : (m = reRgbaInteger.exec(format)) ? rgba(m[1], m[2], m[3], m[4]) : (m = reRgbaPercent.exec(format)) ? rgba(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, m[4]) : (m = reHslPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, 1) : (m = reHslaPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, m[4]) : named.hasOwnProperty(format) ? rgbn(named[format]) : format === "transparent" ? new Rgb(NaN, NaN, NaN, 0) : null;
}
function rgbn(n) {
	return new Rgb(n >> 16 & 255, n >> 8 & 255, n & 255, 1);
}
function rgba(r, g, b, a) {
	if (a <= 0) r = g = b = NaN;
	return new Rgb(r, g, b, a);
}
function rgbConvert(o) {
	if (!(o instanceof Color)) o = color(o);
	if (!o) return new Rgb();
	o = o.rgb();
	return new Rgb(o.r, o.g, o.b, o.opacity);
}
function rgb(r, g, b, opacity) {
	return arguments.length === 1 ? rgbConvert(r) : new Rgb(r, g, b, opacity == null ? 1 : opacity);
}
function Rgb(r, g, b, opacity) {
	this.r = +r;
	this.g = +g;
	this.b = +b;
	this.opacity = +opacity;
}
define_default(Rgb, rgb, extend(Color, {
	brighter(k) {
		k = k == null ? brighter : Math.pow(brighter, k);
		return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
	},
	darker(k) {
		k = k == null ? darker : Math.pow(darker, k);
		return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
	},
	rgb() {
		return this;
	},
	clamp() {
		return new Rgb(clampi(this.r), clampi(this.g), clampi(this.b), clampa(this.opacity));
	},
	displayable() {
		return -.5 <= this.r && this.r < 255.5 && -.5 <= this.g && this.g < 255.5 && -.5 <= this.b && this.b < 255.5 && 0 <= this.opacity && this.opacity <= 1;
	},
	hex: rgb_formatHex,
	formatHex: rgb_formatHex,
	formatHex8: rgb_formatHex8,
	formatRgb: rgb_formatRgb,
	toString: rgb_formatRgb
}));
function rgb_formatHex() {
	return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}`;
}
function rgb_formatHex8() {
	return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}${hex((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
}
function rgb_formatRgb() {
	const a = clampa(this.opacity);
	return `${a === 1 ? "rgb(" : "rgba("}${clampi(this.r)}, ${clampi(this.g)}, ${clampi(this.b)}${a === 1 ? ")" : `, ${a})`}`;
}
function clampa(opacity) {
	return isNaN(opacity) ? 1 : Math.max(0, Math.min(1, opacity));
}
function clampi(value) {
	return Math.max(0, Math.min(255, Math.round(value) || 0));
}
function hex(value) {
	value = clampi(value);
	return (value < 16 ? "0" : "") + value.toString(16);
}
function hsla(h, s, l, a) {
	if (a <= 0) h = s = l = NaN;
	else if (l <= 0 || l >= 1) h = s = NaN;
	else if (s <= 0) h = NaN;
	return new Hsl(h, s, l, a);
}
function hslConvert(o) {
	if (o instanceof Hsl) return new Hsl(o.h, o.s, o.l, o.opacity);
	if (!(o instanceof Color)) o = color(o);
	if (!o) return new Hsl();
	if (o instanceof Hsl) return o;
	o = o.rgb();
	var r = o.r / 255, g = o.g / 255, b = o.b / 255, min = Math.min(r, g, b), max = Math.max(r, g, b), h = NaN, s = max - min, l = (max + min) / 2;
	if (s) {
		if (r === max) h = (g - b) / s + (g < b) * 6;
		else if (g === max) h = (b - r) / s + 2;
		else h = (r - g) / s + 4;
		s /= l < .5 ? max + min : 2 - max - min;
		h *= 60;
	} else s = l > 0 && l < 1 ? 0 : h;
	return new Hsl(h, s, l, o.opacity);
}
function hsl(h, s, l, opacity) {
	return arguments.length === 1 ? hslConvert(h) : new Hsl(h, s, l, opacity == null ? 1 : opacity);
}
function Hsl(h, s, l, opacity) {
	this.h = +h;
	this.s = +s;
	this.l = +l;
	this.opacity = +opacity;
}
define_default(Hsl, hsl, extend(Color, {
	brighter(k) {
		k = k == null ? brighter : Math.pow(brighter, k);
		return new Hsl(this.h, this.s, this.l * k, this.opacity);
	},
	darker(k) {
		k = k == null ? darker : Math.pow(darker, k);
		return new Hsl(this.h, this.s, this.l * k, this.opacity);
	},
	rgb() {
		var h = this.h % 360 + (this.h < 0) * 360, s = isNaN(h) || isNaN(this.s) ? 0 : this.s, l = this.l, m2 = l + (l < .5 ? l : 1 - l) * s, m1 = 2 * l - m2;
		return new Rgb(hsl2rgb(h >= 240 ? h - 240 : h + 120, m1, m2), hsl2rgb(h, m1, m2), hsl2rgb(h < 120 ? h + 240 : h - 120, m1, m2), this.opacity);
	},
	clamp() {
		return new Hsl(clamph(this.h), clampt(this.s), clampt(this.l), clampa(this.opacity));
	},
	displayable() {
		return (0 <= this.s && this.s <= 1 || isNaN(this.s)) && 0 <= this.l && this.l <= 1 && 0 <= this.opacity && this.opacity <= 1;
	},
	formatHsl() {
		const a = clampa(this.opacity);
		return `${a === 1 ? "hsl(" : "hsla("}${clamph(this.h)}, ${clampt(this.s) * 100}%, ${clampt(this.l) * 100}%${a === 1 ? ")" : `, ${a})`}`;
	}
}));
function clamph(value) {
	value = (value || 0) % 360;
	return value < 0 ? value + 360 : value;
}
function clampt(value) {
	return Math.max(0, Math.min(1, value || 0));
}
function hsl2rgb(h, m1, m2) {
	return (h < 60 ? m1 + (m2 - m1) * h / 60 : h < 180 ? m2 : h < 240 ? m1 + (m2 - m1) * (240 - h) / 60 : m1) * 255;
}
//#endregion
//#region
var constant_default$1 = (x) => () => x;
//#endregion
//#region
function linear(a, d) {
	return function(t) {
		return a + t * d;
	};
}
function exponential(a, b, y) {
	return a = Math.pow(a, y), b = Math.pow(b, y) - a, y = 1 / y, function(t) {
		return Math.pow(a + t * b, y);
	};
}
function gamma(y) {
	return (y = +y) === 1 ? nogamma : function(a, b) {
		return b - a ? exponential(a, b, y) : constant_default$1(isNaN(a) ? b : a);
	};
}
function nogamma(a, b) {
	var d = b - a;
	return d ? linear(a, d) : constant_default$1(isNaN(a) ? b : a);
}
//#endregion
//#region
var rgb_default = (function rgbGamma(y) {
	var color = gamma(y);
	function rgb$1(start, end) {
		var r = color((start = rgb(start)).r, (end = rgb(end)).r), g = color(start.g, end.g), b = color(start.b, end.b), opacity = nogamma(start.opacity, end.opacity);
		return function(t) {
			start.r = r(t);
			start.g = g(t);
			start.b = b(t);
			start.opacity = opacity(t);
			return start + "";
		};
	}
	rgb$1.gamma = rgbGamma;
	return rgb$1;
})(1);
//#endregion
//#region
function numberArray_default(a, b) {
	if (!b) b = [];
	var n = a ? Math.min(b.length, a.length) : 0, c = b.slice(), i;
	return function(t) {
		for (i = 0; i < n; ++i) c[i] = a[i] * (1 - t) + b[i] * t;
		return c;
	};
}
function isNumberArray(x) {
	return ArrayBuffer.isView(x) && !(x instanceof DataView);
}
//#endregion
//#region
function genericArray(a, b) {
	var nb = b ? b.length : 0, na = a ? Math.min(nb, a.length) : 0, x = new Array(na), c = new Array(nb), i;
	for (i = 0; i < na; ++i) x[i] = value_default(a[i], b[i]);
	for (; i < nb; ++i) c[i] = b[i];
	return function(t) {
		for (i = 0; i < na; ++i) c[i] = x[i](t);
		return c;
	};
}
//#endregion
//#region
function date_default(a, b) {
	var d = /* @__PURE__ */ new Date();
	return a = +a, b = +b, function(t) {
		return d.setTime(a * (1 - t) + b * t), d;
	};
}
//#endregion
//#region
function number_default(a, b) {
	return a = +a, b = +b, function(t) {
		return a * (1 - t) + b * t;
	};
}
//#endregion
//#region
function object_default(a, b) {
	var i = {}, c = {}, k;
	if (a === null || typeof a !== "object") a = {};
	if (b === null || typeof b !== "object") b = {};
	for (k in b) if (k in a) i[k] = value_default(a[k], b[k]);
	else c[k] = b[k];
	return function(t) {
		for (k in i) c[k] = i[k](t);
		return c;
	};
}
//#endregion
//#region
var reA = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g;
var reB = new RegExp(reA.source, "g");
function zero(b) {
	return function() {
		return b;
	};
}
function one(b) {
	return function(t) {
		return b(t) + "";
	};
}
function string_default(a, b) {
	var bi = reA.lastIndex = reB.lastIndex = 0, am, bm, bs, i = -1, s = [], q = [];
	a = a + "", b = b + "";
	while ((am = reA.exec(a)) && (bm = reB.exec(b))) {
		if ((bs = bm.index) > bi) {
			bs = b.slice(bi, bs);
			if (s[i]) s[i] += bs;
			else s[++i] = bs;
		}
		if ((am = am[0]) === (bm = bm[0])) {
			if (s[i]) s[i] += bm;
			else s[++i] = bm;
		} else {
			s[++i] = null;
			q.push({
				i,
				x: number_default(am, bm)
			});
		}
		bi = reB.lastIndex;
	}
	if (bi < b.length) {
		bs = b.slice(bi);
		if (s[i]) s[i] += bs;
		else s[++i] = bs;
	}
	return s.length < 2 ? q[0] ? one(q[0].x) : zero(b) : (b = q.length, function(t) {
		for (var i = 0, o; i < b; ++i) s[(o = q[i]).i] = o.x(t);
		return s.join("");
	});
}
//#endregion
//#region
function value_default(a, b) {
	var t = typeof b, c;
	return b == null || t === "boolean" ? constant_default$1(b) : (t === "number" ? number_default : t === "string" ? (c = color(b)) ? (b = c, rgb_default) : string_default : b instanceof color ? rgb_default : b instanceof Date ? date_default : isNumberArray(b) ? numberArray_default : Array.isArray(b) ? genericArray : typeof b.valueOf !== "function" && typeof b.toString !== "function" || isNaN(b) ? object_default : number_default)(a, b);
}
//#endregion
//#region
var degrees = 180 / Math.PI;
var identity$2 = {
	translateX: 0,
	translateY: 0,
	rotate: 0,
	skewX: 0,
	scaleX: 1,
	scaleY: 1
};
function decompose_default(a, b, c, d, e, f) {
	var scaleX, scaleY, skewX;
	if (scaleX = Math.sqrt(a * a + b * b)) a /= scaleX, b /= scaleX;
	if (skewX = a * c + b * d) c -= a * skewX, d -= b * skewX;
	if (scaleY = Math.sqrt(c * c + d * d)) c /= scaleY, d /= scaleY, skewX /= scaleY;
	if (a * d < b * c) a = -a, b = -b, skewX = -skewX, scaleX = -scaleX;
	return {
		translateX: e,
		translateY: f,
		rotate: Math.atan2(b, a) * degrees,
		skewX: Math.atan(skewX) * degrees,
		scaleX,
		scaleY
	};
}
//#endregion
//#region
var svgNode;
function parseCss(value) {
	const m = new (typeof DOMMatrix === "function" ? DOMMatrix : WebKitCSSMatrix)(value + "");
	return m.isIdentity ? identity$2 : decompose_default(m.a, m.b, m.c, m.d, m.e, m.f);
}
function parseSvg(value) {
	if (value == null) return identity$2;
	if (!svgNode) svgNode = document.createElementNS("http://www.w3.org/2000/svg", "g");
	svgNode.setAttribute("transform", value);
	if (!(value = svgNode.transform.baseVal.consolidate())) return identity$2;
	value = value.matrix;
	return decompose_default(value.a, value.b, value.c, value.d, value.e, value.f);
}
//#endregion
//#region
function interpolateTransform(parse, pxComma, pxParen, degParen) {
	function pop(s) {
		return s.length ? s.pop() + " " : "";
	}
	function translate(xa, ya, xb, yb, s, q) {
		if (xa !== xb || ya !== yb) {
			var i = s.push("translate(", null, pxComma, null, pxParen);
			q.push({
				i: i - 4,
				x: number_default(xa, xb)
			}, {
				i: i - 2,
				x: number_default(ya, yb)
			});
		} else if (xb || yb) s.push("translate(" + xb + pxComma + yb + pxParen);
	}
	function rotate(a, b, s, q) {
		if (a !== b) {
			if (a - b > 180) b += 360;
			else if (b - a > 180) a += 360;
			q.push({
				i: s.push(pop(s) + "rotate(", null, degParen) - 2,
				x: number_default(a, b)
			});
		} else if (b) s.push(pop(s) + "rotate(" + b + degParen);
	}
	function skewX(a, b, s, q) {
		if (a !== b) q.push({
			i: s.push(pop(s) + "skewX(", null, degParen) - 2,
			x: number_default(a, b)
		});
		else if (b) s.push(pop(s) + "skewX(" + b + degParen);
	}
	function scale(xa, ya, xb, yb, s, q) {
		if (xa !== xb || ya !== yb) {
			var i = s.push(pop(s) + "scale(", null, ",", null, ")");
			q.push({
				i: i - 4,
				x: number_default(xa, xb)
			}, {
				i: i - 2,
				x: number_default(ya, yb)
			});
		} else if (xb !== 1 || yb !== 1) s.push(pop(s) + "scale(" + xb + "," + yb + ")");
	}
	return function(a, b) {
		var s = [], q = [];
		a = parse(a), b = parse(b);
		translate(a.translateX, a.translateY, b.translateX, b.translateY, s, q);
		rotate(a.rotate, b.rotate, s, q);
		skewX(a.skewX, b.skewX, s, q);
		scale(a.scaleX, a.scaleY, b.scaleX, b.scaleY, s, q);
		a = b = null;
		return function(t) {
			var i = -1, n = q.length, o;
			while (++i < n) s[(o = q[i]).i] = o.x(t);
			return s.join("");
		};
	};
}
var interpolateTransformCss = interpolateTransform(parseCss, "px, ", "px)", "deg)");
var interpolateTransformSvg = interpolateTransform(parseSvg, ", ", ")", ")");
//#endregion
//#region
var epsilon2 = 1e-12;
function cosh(x) {
	return ((x = Math.exp(x)) + 1 / x) / 2;
}
function sinh(x) {
	return ((x = Math.exp(x)) - 1 / x) / 2;
}
function tanh(x) {
	return ((x = Math.exp(2 * x)) - 1) / (x + 1);
}
var zoom_default$1 = (function zoomRho(rho, rho2, rho4) {
	function zoom(p0, p1) {
		var ux0 = p0[0], uy0 = p0[1], w0 = p0[2], ux1 = p1[0], uy1 = p1[1], w1 = p1[2], dx = ux1 - ux0, dy = uy1 - uy0, d2 = dx * dx + dy * dy, i, S;
		if (d2 < epsilon2) {
			S = Math.log(w1 / w0) / rho;
			i = function(t) {
				return [
					ux0 + t * dx,
					uy0 + t * dy,
					w0 * Math.exp(rho * t * S)
				];
			};
		} else {
			var d1 = Math.sqrt(d2), b0 = (w1 * w1 - w0 * w0 + rho4 * d2) / (2 * w0 * rho2 * d1), b1 = (w1 * w1 - w0 * w0 - rho4 * d2) / (2 * w1 * rho2 * d1), r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
			S = (Math.log(Math.sqrt(b1 * b1 + 1) - b1) - r0) / rho;
			i = function(t) {
				var s = t * S, coshr0 = cosh(r0), u = w0 / (rho2 * d1) * (coshr0 * tanh(rho * s + r0) - sinh(r0));
				return [
					ux0 + u * dx,
					uy0 + u * dy,
					w0 * coshr0 / cosh(rho * s + r0)
				];
			};
		}
		i.duration = S * 1e3 * rho / Math.SQRT2;
		return i;
	}
	zoom.rho = function(_) {
		var _1 = Math.max(.001, +_), _2 = _1 * _1;
		return zoomRho(_1, _2, _2 * _2);
	};
	return zoom;
})(Math.SQRT2, 2, 4);
//#endregion
//#region
var frame = 0;
var timeout = 0;
var interval = 0;
var pokeDelay = 1e3;
var taskHead;
var taskTail;
var clockLast = 0;
var clockNow = 0;
var clockSkew = 0;
var clock = typeof performance === "object" && performance.now ? performance : Date;
var setFrame = typeof window === "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(f) {
	setTimeout(f, 17);
};
function now() {
	return clockNow || (setFrame(clearNow), clockNow = clock.now() + clockSkew);
}
function clearNow() {
	clockNow = 0;
}
function Timer() {
	this._call = this._time = this._next = null;
}
Timer.prototype = timer.prototype = {
	constructor: Timer,
	restart: function(callback, delay, time) {
		if (typeof callback !== "function") throw new TypeError("callback is not a function");
		time = (time == null ? now() : +time) + (delay == null ? 0 : +delay);
		if (!this._next && taskTail !== this) {
			if (taskTail) taskTail._next = this;
			else taskHead = this;
			taskTail = this;
		}
		this._call = callback;
		this._time = time;
		sleep();
	},
	stop: function() {
		if (this._call) {
			this._call = null;
			this._time = Infinity;
			sleep();
		}
	}
};
function timer(callback, delay, time) {
	var t = new Timer();
	t.restart(callback, delay, time);
	return t;
}
function timerFlush() {
	now();
	++frame;
	var t = taskHead, e;
	while (t) {
		if ((e = clockNow - t._time) >= 0) t._call.call(void 0, e);
		t = t._next;
	}
	--frame;
}
function wake() {
	clockNow = (clockLast = clock.now()) + clockSkew;
	frame = timeout = 0;
	try {
		timerFlush();
	} finally {
		frame = 0;
		nap();
		clockNow = 0;
	}
}
function poke() {
	var now = clock.now(), delay = now - clockLast;
	if (delay > pokeDelay) clockSkew -= delay, clockLast = now;
}
function nap() {
	var t0, t1 = taskHead, t2, time = Infinity;
	while (t1) if (t1._call) {
		if (time > t1._time) time = t1._time;
		t0 = t1, t1 = t1._next;
	} else {
		t2 = t1._next, t1._next = null;
		t1 = t0 ? t0._next = t2 : taskHead = t2;
	}
	taskTail = t0;
	sleep(time);
}
function sleep(time) {
	if (frame) return;
	if (timeout) timeout = clearTimeout(timeout);
	if (time - clockNow > 24) {
		if (time < Infinity) timeout = setTimeout(wake, time - clock.now() - clockSkew);
		if (interval) interval = clearInterval(interval);
	} else {
		if (!interval) clockLast = clock.now(), interval = setInterval(poke, pokeDelay);
		frame = 1, setFrame(wake);
	}
}
//#endregion
//#region
function timeout_default(callback, delay, time) {
	var t = new Timer();
	delay = delay == null ? 0 : +delay;
	t.restart((elapsed) => {
		t.stop();
		callback(elapsed + delay);
	}, delay, time);
	return t;
}
//#endregion
//#region
var emptyOn = dispatch("start", "end", "cancel", "interrupt");
var emptyTween = [];
function schedule_default(node, name, id, index, group, timing) {
	var schedules = node.__transition;
	if (!schedules) node.__transition = {};
	else if (id in schedules) return;
	create(node, id, {
		name,
		index,
		group,
		on: emptyOn,
		tween: emptyTween,
		time: timing.time,
		delay: timing.delay,
		duration: timing.duration,
		ease: timing.ease,
		timer: null,
		state: 0
	});
}
function init(node, id) {
	var schedule = get(node, id);
	if (schedule.state > 0) throw new Error("too late; already scheduled");
	return schedule;
}
function set(node, id) {
	var schedule = get(node, id);
	if (schedule.state > 3) throw new Error("too late; already running");
	return schedule;
}
function get(node, id) {
	var schedule = node.__transition;
	if (!schedule || !(schedule = schedule[id])) throw new Error("transition not found");
	return schedule;
}
function create(node, id, self) {
	var schedules = node.__transition, tween;
	schedules[id] = self;
	self.timer = timer(schedule, 0, self.time);
	function schedule(elapsed) {
		self.state = 1;
		self.timer.restart(start, self.delay, self.time);
		if (self.delay <= elapsed) start(elapsed - self.delay);
	}
	function start(elapsed) {
		var i, j, n, o;
		if (self.state !== 1) return stop();
		for (i in schedules) {
			o = schedules[i];
			if (o.name !== self.name) continue;
			if (o.state === 3) return timeout_default(start);
			if (o.state === 4) {
				o.state = 6;
				o.timer.stop();
				o.on.call("interrupt", node, node.__data__, o.index, o.group);
				delete schedules[i];
			} else if (+i < id) {
				o.state = 6;
				o.timer.stop();
				o.on.call("cancel", node, node.__data__, o.index, o.group);
				delete schedules[i];
			}
		}
		timeout_default(function() {
			if (self.state === 3) {
				self.state = 4;
				self.timer.restart(tick, self.delay, self.time);
				tick(elapsed);
			}
		});
		self.state = 2;
		self.on.call("start", node, node.__data__, self.index, self.group);
		if (self.state !== 2) return;
		self.state = 3;
		tween = new Array(n = self.tween.length);
		for (i = 0, j = -1; i < n; ++i) if (o = self.tween[i].value.call(node, node.__data__, self.index, self.group)) tween[++j] = o;
		tween.length = j + 1;
	}
	function tick(elapsed) {
		var t = elapsed < self.duration ? self.ease.call(null, elapsed / self.duration) : (self.timer.restart(stop), self.state = 5, 1), i = -1, n = tween.length;
		while (++i < n) tween[i].call(node, t);
		if (self.state === 5) {
			self.on.call("end", node, node.__data__, self.index, self.group);
			stop();
		}
	}
	function stop() {
		self.state = 6;
		self.timer.stop();
		delete schedules[id];
		for (var i in schedules) return;
		delete node.__transition;
	}
}
//#endregion
//#region
function interrupt_default$1(node, name) {
	var schedules = node.__transition, schedule, active, empty = true, i;
	if (!schedules) return;
	name = name == null ? null : name + "";
	for (i in schedules) {
		if ((schedule = schedules[i]).name !== name) {
			empty = false;
			continue;
		}
		active = schedule.state > 2 && schedule.state < 5;
		schedule.state = 6;
		schedule.timer.stop();
		schedule.on.call(active ? "interrupt" : "cancel", node, node.__data__, schedule.index, schedule.group);
		delete schedules[i];
	}
	if (empty) delete node.__transition;
}
//#endregion
//#region
function interrupt_default(name) {
	return this.each(function() {
		interrupt_default$1(this, name);
	});
}
//#endregion
//#region
function tweenRemove(id, name) {
	var tween0, tween1;
	return function() {
		var schedule = set(this, id), tween = schedule.tween;
		if (tween !== tween0) {
			tween1 = tween0 = tween;
			for (var i = 0, n = tween1.length; i < n; ++i) if (tween1[i].name === name) {
				tween1 = tween1.slice();
				tween1.splice(i, 1);
				break;
			}
		}
		schedule.tween = tween1;
	};
}
function tweenFunction(id, name, value) {
	var tween0, tween1;
	if (typeof value !== "function") throw new Error();
	return function() {
		var schedule = set(this, id), tween = schedule.tween;
		if (tween !== tween0) {
			tween1 = (tween0 = tween).slice();
			for (var t = {
				name,
				value
			}, i = 0, n = tween1.length; i < n; ++i) if (tween1[i].name === name) {
				tween1[i] = t;
				break;
			}
			if (i === n) tween1.push(t);
		}
		schedule.tween = tween1;
	};
}
function tween_default(name, value) {
	var id = this._id;
	name += "";
	if (arguments.length < 2) {
		var tween = get(this.node(), id).tween;
		for (var i = 0, n = tween.length, t; i < n; ++i) if ((t = tween[i]).name === name) return t.value;
		return null;
	}
	return this.each((value == null ? tweenRemove : tweenFunction)(id, name, value));
}
function tweenValue(transition, name, value) {
	var id = transition._id;
	transition.each(function() {
		var schedule = set(this, id);
		(schedule.value || (schedule.value = {}))[name] = value.apply(this, arguments);
	});
	return function(node) {
		return get(node, id).value[name];
	};
}
//#endregion
//#region
function interpolate_default(a, b) {
	var c;
	return (typeof b === "number" ? number_default : b instanceof color ? rgb_default : (c = color(b)) ? (b = c, rgb_default) : string_default)(a, b);
}
//#endregion
//#region
function attrRemove(name) {
	return function() {
		this.removeAttribute(name);
	};
}
function attrRemoveNS(fullname) {
	return function() {
		this.removeAttributeNS(fullname.space, fullname.local);
	};
}
function attrConstant(name, interpolate, value1) {
	var string00, string1 = value1 + "", interpolate0;
	return function() {
		var string0 = this.getAttribute(name);
		return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate(string00 = string0, value1);
	};
}
function attrConstantNS(fullname, interpolate, value1) {
	var string00, string1 = value1 + "", interpolate0;
	return function() {
		var string0 = this.getAttributeNS(fullname.space, fullname.local);
		return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate(string00 = string0, value1);
	};
}
function attrFunction(name, interpolate, value) {
	var string00, string10, interpolate0;
	return function() {
		var string0, value1 = value(this), string1;
		if (value1 == null) return void this.removeAttribute(name);
		string0 = this.getAttribute(name);
		string1 = value1 + "";
		return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
	};
}
function attrFunctionNS(fullname, interpolate, value) {
	var string00, string10, interpolate0;
	return function() {
		var string0, value1 = value(this), string1;
		if (value1 == null) return void this.removeAttributeNS(fullname.space, fullname.local);
		string0 = this.getAttributeNS(fullname.space, fullname.local);
		string1 = value1 + "";
		return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
	};
}
function attr_default(name, value) {
	var fullname = namespace_default(name), i = fullname === "transform" ? interpolateTransformSvg : interpolate_default;
	return this.attrTween(name, typeof value === "function" ? (fullname.local ? attrFunctionNS : attrFunction)(fullname, i, tweenValue(this, "attr." + name, value)) : value == null ? (fullname.local ? attrRemoveNS : attrRemove)(fullname) : (fullname.local ? attrConstantNS : attrConstant)(fullname, i, value));
}
//#endregion
//#region
function attrInterpolate(name, i) {
	return function(t) {
		this.setAttribute(name, i.call(this, t));
	};
}
function attrInterpolateNS(fullname, i) {
	return function(t) {
		this.setAttributeNS(fullname.space, fullname.local, i.call(this, t));
	};
}
function attrTweenNS(fullname, value) {
	var t0, i0;
	function tween() {
		var i = value.apply(this, arguments);
		if (i !== i0) t0 = (i0 = i) && attrInterpolateNS(fullname, i);
		return t0;
	}
	tween._value = value;
	return tween;
}
function attrTween(name, value) {
	var t0, i0;
	function tween() {
		var i = value.apply(this, arguments);
		if (i !== i0) t0 = (i0 = i) && attrInterpolate(name, i);
		return t0;
	}
	tween._value = value;
	return tween;
}
function attrTween_default(name, value) {
	var key = "attr." + name;
	if (arguments.length < 2) return (key = this.tween(key)) && key._value;
	if (value == null) return this.tween(key, null);
	if (typeof value !== "function") throw new Error();
	var fullname = namespace_default(name);
	return this.tween(key, (fullname.local ? attrTweenNS : attrTween)(fullname, value));
}
//#endregion
//#region
function delayFunction(id, value) {
	return function() {
		init(this, id).delay = +value.apply(this, arguments);
	};
}
function delayConstant(id, value) {
	return value = +value, function() {
		init(this, id).delay = value;
	};
}
function delay_default(value) {
	var id = this._id;
	return arguments.length ? this.each((typeof value === "function" ? delayFunction : delayConstant)(id, value)) : get(this.node(), id).delay;
}
//#endregion
//#region
function durationFunction(id, value) {
	return function() {
		set(this, id).duration = +value.apply(this, arguments);
	};
}
function durationConstant(id, value) {
	return value = +value, function() {
		set(this, id).duration = value;
	};
}
function duration_default(value) {
	var id = this._id;
	return arguments.length ? this.each((typeof value === "function" ? durationFunction : durationConstant)(id, value)) : get(this.node(), id).duration;
}
//#endregion
//#region
function easeConstant(id, value) {
	if (typeof value !== "function") throw new Error();
	return function() {
		set(this, id).ease = value;
	};
}
function ease_default(value) {
	var id = this._id;
	return arguments.length ? this.each(easeConstant(id, value)) : get(this.node(), id).ease;
}
//#endregion
//#region
function easeVarying(id, value) {
	return function() {
		var v = value.apply(this, arguments);
		if (typeof v !== "function") throw new Error();
		set(this, id).ease = v;
	};
}
function easeVarying_default(value) {
	if (typeof value !== "function") throw new Error();
	return this.each(easeVarying(this._id, value));
}
//#endregion
//#region
function filter_default(match) {
	if (typeof match !== "function") match = matcher_default(match);
	for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) if ((node = group[i]) && match.call(node, node.__data__, i, group)) subgroup.push(node);
	return new Transition(subgroups, this._parents, this._name, this._id);
}
//#endregion
//#region
function merge_default(transition) {
	if (transition._id !== this._id) throw new Error();
	for (var groups0 = this._groups, groups1 = transition._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) if (node = group0[i] || group1[i]) merge[i] = node;
	for (; j < m0; ++j) merges[j] = groups0[j];
	return new Transition(merges, this._parents, this._name, this._id);
}
//#endregion
//#region
function start(name) {
	return (name + "").trim().split(/^|\s+/).every(function(t) {
		var i = t.indexOf(".");
		if (i >= 0) t = t.slice(0, i);
		return !t || t === "start";
	});
}
function onFunction(id, name, listener) {
	var on0, on1, sit = start(name) ? init : set;
	return function() {
		var schedule = sit(this, id), on = schedule.on;
		if (on !== on0) (on1 = (on0 = on).copy()).on(name, listener);
		schedule.on = on1;
	};
}
function on_default(name, listener) {
	var id = this._id;
	return arguments.length < 2 ? get(this.node(), id).on.on(name) : this.each(onFunction(id, name, listener));
}
//#endregion
//#region
function removeFunction(id) {
	return function() {
		var parent = this.parentNode;
		for (var i in this.__transition) if (+i !== id) return;
		if (parent) parent.removeChild(this);
	};
}
function remove_default() {
	return this.on("end.remove", removeFunction(this._id));
}
//#endregion
//#region
function select_default(select) {
	var name = this._name, id = this._id;
	if (typeof select !== "function") select = selector_default(select);
	for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) if ((node = group[i]) && (subnode = select.call(node, node.__data__, i, group))) {
		if ("__data__" in node) subnode.__data__ = node.__data__;
		subgroup[i] = subnode;
		schedule_default(subgroup[i], name, id, i, subgroup, get(node, id));
	}
	return new Transition(subgroups, this._parents, name, id);
}
//#endregion
//#region
function selectAll_default(select) {
	var name = this._name, id = this._id;
	if (typeof select !== "function") select = selectorAll_default(select);
	for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) if (node = group[i]) {
		for (var children = select.call(node, node.__data__, i, group), child, inherit = get(node, id), k = 0, l = children.length; k < l; ++k) if (child = children[k]) schedule_default(child, name, id, k, children, inherit);
		subgroups.push(children);
		parents.push(node);
	}
	return new Transition(subgroups, parents, name, id);
}
//#endregion
//#region
var Selection = selection.prototype.constructor;
function selection_default() {
	return new Selection(this._groups, this._parents);
}
//#endregion
//#region
function styleNull(name, interpolate) {
	var string00, string10, interpolate0;
	return function() {
		var string0 = styleValue(this, name), string1 = (this.style.removeProperty(name), styleValue(this, name));
		return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : interpolate0 = interpolate(string00 = string0, string10 = string1);
	};
}
function styleRemove(name) {
	return function() {
		this.style.removeProperty(name);
	};
}
function styleConstant(name, interpolate, value1) {
	var string00, string1 = value1 + "", interpolate0;
	return function() {
		var string0 = styleValue(this, name);
		return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate(string00 = string0, value1);
	};
}
function styleFunction(name, interpolate, value) {
	var string00, string10, interpolate0;
	return function() {
		var string0 = styleValue(this, name), value1 = value(this), string1 = value1 + "";
		if (value1 == null) string1 = value1 = (this.style.removeProperty(name), styleValue(this, name));
		return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
	};
}
function styleMaybeRemove(id, name) {
	var on0, on1, listener0, key = "style." + name, event = "end." + key, remove;
	return function() {
		var schedule = set(this, id), on = schedule.on, listener = schedule.value[key] == null ? remove || (remove = styleRemove(name)) : void 0;
		if (on !== on0 || listener0 !== listener) (on1 = (on0 = on).copy()).on(event, listener0 = listener);
		schedule.on = on1;
	};
}
function style_default$1(name, value, priority) {
	var i = (name += "") === "transform" ? interpolateTransformCss : interpolate_default;
	return value == null ? this.styleTween(name, styleNull(name, i)).on("end.style." + name, styleRemove(name)) : typeof value === "function" ? this.styleTween(name, styleFunction(name, i, tweenValue(this, "style." + name, value))).each(styleMaybeRemove(this._id, name)) : this.styleTween(name, styleConstant(name, i, value), priority).on("end.style." + name, null);
}
//#endregion
//#region
function styleInterpolate(name, i, priority) {
	return function(t) {
		this.style.setProperty(name, i.call(this, t), priority);
	};
}
function styleTween(name, value, priority) {
	var t, i0;
	function tween() {
		var i = value.apply(this, arguments);
		if (i !== i0) t = (i0 = i) && styleInterpolate(name, i, priority);
		return t;
	}
	tween._value = value;
	return tween;
}
function styleTween_default(name, value, priority) {
	var key = "style." + (name += "");
	if (arguments.length < 2) return (key = this.tween(key)) && key._value;
	if (value == null) return this.tween(key, null);
	if (typeof value !== "function") throw new Error();
	return this.tween(key, styleTween(name, value, priority == null ? "" : priority));
}
//#endregion
//#region
function textConstant(value) {
	return function() {
		this.textContent = value;
	};
}
function textFunction(value) {
	return function() {
		var value1 = value(this);
		this.textContent = value1 == null ? "" : value1;
	};
}
function text_default(value) {
	return this.tween("text", typeof value === "function" ? textFunction(tweenValue(this, "text", value)) : textConstant(value == null ? "" : value + ""));
}
//#endregion
//#region
function textInterpolate(i) {
	return function(t) {
		this.textContent = i.call(this, t);
	};
}
function textTween(value) {
	var t0, i0;
	function tween() {
		var i = value.apply(this, arguments);
		if (i !== i0) t0 = (i0 = i) && textInterpolate(i);
		return t0;
	}
	tween._value = value;
	return tween;
}
function textTween_default(value) {
	var key = "text";
	if (arguments.length < 1) return (key = this.tween(key)) && key._value;
	if (value == null) return this.tween(key, null);
	if (typeof value !== "function") throw new Error();
	return this.tween(key, textTween(value));
}
//#endregion
//#region
function transition_default$1() {
	var name = this._name, id0 = this._id, id1 = newId();
	for (var groups = this._groups, m = groups.length, j = 0; j < m; ++j) for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) if (node = group[i]) {
		var inherit = get(node, id0);
		schedule_default(node, name, id1, i, group, {
			time: inherit.time + inherit.delay + inherit.duration,
			delay: 0,
			duration: inherit.duration,
			ease: inherit.ease
		});
	}
	return new Transition(groups, this._parents, name, id1);
}
//#endregion
//#region
function end_default() {
	var on0, on1, that = this, id = that._id, size = that.size();
	return new Promise(function(resolve, reject) {
		var cancel = { value: reject }, end = { value: function() {
			if (--size === 0) resolve();
		} };
		that.each(function() {
			var schedule = set(this, id), on = schedule.on;
			if (on !== on0) {
				on1 = (on0 = on).copy();
				on1._.cancel.push(cancel);
				on1._.interrupt.push(cancel);
				on1._.end.push(end);
			}
			schedule.on = on1;
		});
		if (size === 0) resolve();
	});
}
//#endregion
//#region
var id = 0;
function Transition(groups, parents, name, id) {
	this._groups = groups;
	this._parents = parents;
	this._name = name;
	this._id = id;
}
function transition(name) {
	return selection().transition(name);
}
function newId() {
	return ++id;
}
var selection_prototype = selection.prototype;
Transition.prototype = transition.prototype = {
	constructor: Transition,
	select: select_default,
	selectAll: selectAll_default,
	selectChild: selection_prototype.selectChild,
	selectChildren: selection_prototype.selectChildren,
	filter: filter_default,
	merge: merge_default,
	selection: selection_default,
	transition: transition_default$1,
	call: selection_prototype.call,
	nodes: selection_prototype.nodes,
	node: selection_prototype.node,
	size: selection_prototype.size,
	empty: selection_prototype.empty,
	each: selection_prototype.each,
	on: on_default,
	attr: attr_default,
	attrTween: attrTween_default,
	style: style_default$1,
	styleTween: styleTween_default,
	text: text_default,
	textTween: textTween_default,
	remove: remove_default,
	tween: tween_default,
	delay: delay_default,
	duration: duration_default,
	ease: ease_default,
	easeVarying: easeVarying_default,
	end: end_default,
	[Symbol.iterator]: selection_prototype[Symbol.iterator]
};
//#endregion
//#region
function cubicInOut(t) {
	return ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;
}
//#endregion
//#region
var defaultTiming = {
	time: null,
	delay: 0,
	duration: 250,
	ease: cubicInOut
};
function inherit(node, id) {
	var timing;
	while (!(timing = node.__transition) || !(timing = timing[id])) if (!(node = node.parentNode)) throw new Error(`transition ${id} not found`);
	return timing;
}
function transition_default(name) {
	var id, timing;
	if (name instanceof Transition) id = name._id, name = name._name;
	else id = newId(), (timing = defaultTiming).time = now(), name = name == null ? null : name + "";
	for (var groups = this._groups, m = groups.length, j = 0; j < m; ++j) for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) if (node = group[i]) schedule_default(node, name, id, i, group, timing || inherit(node, id));
	return new Transition(groups, this._parents, name, id);
}
//#endregion
//#region
selection.prototype.interrupt = interrupt_default;
selection.prototype.transition = transition_default;
//#endregion
//#region
var constant_default = (x) => () => x;
//#endregion
//#region
function ZoomEvent(type, { sourceEvent, target, transform, dispatch }) {
	Object.defineProperties(this, {
		type: {
			value: type,
			enumerable: true,
			configurable: true
		},
		sourceEvent: {
			value: sourceEvent,
			enumerable: true,
			configurable: true
		},
		target: {
			value: target,
			enumerable: true,
			configurable: true
		},
		transform: {
			value: transform,
			enumerable: true,
			configurable: true
		},
		_: { value: dispatch }
	});
}
//#endregion
//#region
function Transform(k, x, y) {
	this.k = k;
	this.x = x;
	this.y = y;
}
Transform.prototype = {
	constructor: Transform,
	scale: function(k) {
		return k === 1 ? this : new Transform(this.k * k, this.x, this.y);
	},
	translate: function(x, y) {
		return x === 0 & y === 0 ? this : new Transform(this.k, this.x + this.k * x, this.y + this.k * y);
	},
	apply: function(point) {
		return [point[0] * this.k + this.x, point[1] * this.k + this.y];
	},
	applyX: function(x) {
		return x * this.k + this.x;
	},
	applyY: function(y) {
		return y * this.k + this.y;
	},
	invert: function(location) {
		return [(location[0] - this.x) / this.k, (location[1] - this.y) / this.k];
	},
	invertX: function(x) {
		return (x - this.x) / this.k;
	},
	invertY: function(y) {
		return (y - this.y) / this.k;
	},
	rescaleX: function(x) {
		return x.copy().domain(x.range().map(this.invertX, this).map(x.invert, x));
	},
	rescaleY: function(y) {
		return y.copy().domain(y.range().map(this.invertY, this).map(y.invert, y));
	},
	toString: function() {
		return "translate(" + this.x + "," + this.y + ") scale(" + this.k + ")";
	}
};
var identity$1 = new Transform(1, 0, 0);
transform.prototype = Transform.prototype;
function transform(node) {
	while (!node.__zoom) if (!(node = node.parentNode)) return identity$1;
	return node.__zoom;
}
//#endregion
//#region
function nopropagation(event) {
	event.stopImmediatePropagation();
}
function noevent_default(event) {
	event.preventDefault();
	event.stopImmediatePropagation();
}
//#endregion
//#region
function defaultFilter(event) {
	return (!event.ctrlKey || event.type === "wheel") && !event.button;
}
function defaultExtent() {
	var e = this;
	if (e instanceof SVGElement) {
		e = e.ownerSVGElement || e;
		if (e.hasAttribute("viewBox")) {
			e = e.viewBox.baseVal;
			return [[e.x, e.y], [e.x + e.width, e.y + e.height]];
		}
		return [[0, 0], [e.width.baseVal.value, e.height.baseVal.value]];
	}
	return [[0, 0], [e.clientWidth, e.clientHeight]];
}
function defaultTransform() {
	return this.__zoom || identity$1;
}
function defaultWheelDelta(event) {
	return -event.deltaY * (event.deltaMode === 1 ? .05 : event.deltaMode ? 1 : .002) * (event.ctrlKey ? 10 : 1);
}
function defaultTouchable() {
	return navigator.maxTouchPoints || "ontouchstart" in this;
}
function defaultConstrain(transform, extent, translateExtent) {
	var dx0 = transform.invertX(extent[0][0]) - translateExtent[0][0], dx1 = transform.invertX(extent[1][0]) - translateExtent[1][0], dy0 = transform.invertY(extent[0][1]) - translateExtent[0][1], dy1 = transform.invertY(extent[1][1]) - translateExtent[1][1];
	return transform.translate(dx1 > dx0 ? (dx0 + dx1) / 2 : Math.min(0, dx0) || Math.max(0, dx1), dy1 > dy0 ? (dy0 + dy1) / 2 : Math.min(0, dy0) || Math.max(0, dy1));
}
function zoom_default() {
	var filter = defaultFilter, extent = defaultExtent, constrain = defaultConstrain, wheelDelta = defaultWheelDelta, touchable = defaultTouchable, scaleExtent = [0, Infinity], translateExtent = [[-Infinity, -Infinity], [Infinity, Infinity]], duration = 250, interpolate = zoom_default$1, listeners = dispatch("start", "zoom", "end"), touchstarting, touchfirst, touchending, touchDelay = 500, wheelDelay = 150, clickDistance2 = 0, tapDistance = 10;
	function zoom(selection) {
		selection.property("__zoom", defaultTransform).on("wheel.zoom", wheeled, { passive: false }).on("mousedown.zoom", mousedowned).on("dblclick.zoom", dblclicked).filter(touchable).on("touchstart.zoom", touchstarted).on("touchmove.zoom", touchmoved).on("touchend.zoom touchcancel.zoom", touchended).style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
	}
	zoom.transform = function(collection, transform, point, event) {
		var selection = collection.selection ? collection.selection() : collection;
		selection.property("__zoom", defaultTransform);
		if (collection !== selection) schedule(collection, transform, point, event);
		else selection.interrupt().each(function() {
			gesture(this, arguments).event(event).start().zoom(null, typeof transform === "function" ? transform.apply(this, arguments) : transform).end();
		});
	};
	zoom.scaleBy = function(selection, k, p, event) {
		zoom.scaleTo(selection, function() {
			return this.__zoom.k * (typeof k === "function" ? k.apply(this, arguments) : k);
		}, p, event);
	};
	zoom.scaleTo = function(selection, k, p, event) {
		zoom.transform(selection, function() {
			var e = extent.apply(this, arguments), t0 = this.__zoom, p0 = p == null ? centroid(e) : typeof p === "function" ? p.apply(this, arguments) : p, p1 = t0.invert(p0), k1 = typeof k === "function" ? k.apply(this, arguments) : k;
			return constrain(translate(scale(t0, k1), p0, p1), e, translateExtent);
		}, p, event);
	};
	zoom.translateBy = function(selection, x, y, event) {
		zoom.transform(selection, function() {
			return constrain(this.__zoom.translate(typeof x === "function" ? x.apply(this, arguments) : x, typeof y === "function" ? y.apply(this, arguments) : y), extent.apply(this, arguments), translateExtent);
		}, null, event);
	};
	zoom.translateTo = function(selection, x, y, p, event) {
		zoom.transform(selection, function() {
			var e = extent.apply(this, arguments), t = this.__zoom, p0 = p == null ? centroid(e) : typeof p === "function" ? p.apply(this, arguments) : p;
			return constrain(identity$1.translate(p0[0], p0[1]).scale(t.k).translate(typeof x === "function" ? -x.apply(this, arguments) : -x, typeof y === "function" ? -y.apply(this, arguments) : -y), e, translateExtent);
		}, p, event);
	};
	function scale(transform, k) {
		k = Math.max(scaleExtent[0], Math.min(scaleExtent[1], k));
		return k === transform.k ? transform : new Transform(k, transform.x, transform.y);
	}
	function translate(transform, p0, p1) {
		var x = p0[0] - p1[0] * transform.k, y = p0[1] - p1[1] * transform.k;
		return x === transform.x && y === transform.y ? transform : new Transform(transform.k, x, y);
	}
	function centroid(extent) {
		return [(+extent[0][0] + +extent[1][0]) / 2, (+extent[0][1] + +extent[1][1]) / 2];
	}
	function schedule(transition, transform, point, event) {
		transition.on("start.zoom", function() {
			gesture(this, arguments).event(event).start();
		}).on("interrupt.zoom end.zoom", function() {
			gesture(this, arguments).event(event).end();
		}).tween("zoom", function() {
			var that = this, args = arguments, g = gesture(that, args).event(event), e = extent.apply(that, args), p = point == null ? centroid(e) : typeof point === "function" ? point.apply(that, args) : point, w = Math.max(e[1][0] - e[0][0], e[1][1] - e[0][1]), a = that.__zoom, b = typeof transform === "function" ? transform.apply(that, args) : transform, i = interpolate(a.invert(p).concat(w / a.k), b.invert(p).concat(w / b.k));
			return function(t) {
				if (t === 1) t = b;
				else {
					var l = i(t), k = w / l[2];
					t = new Transform(k, p[0] - l[0] * k, p[1] - l[1] * k);
				}
				g.zoom(null, t);
			};
		});
	}
	function gesture(that, args, clean) {
		return !clean && that.__zooming || new Gesture(that, args);
	}
	function Gesture(that, args) {
		this.that = that;
		this.args = args;
		this.active = 0;
		this.sourceEvent = null;
		this.extent = extent.apply(that, args);
		this.taps = 0;
	}
	Gesture.prototype = {
		event: function(event) {
			if (event) this.sourceEvent = event;
			return this;
		},
		start: function() {
			if (++this.active === 1) {
				this.that.__zooming = this;
				this.emit("start");
			}
			return this;
		},
		zoom: function(key, transform) {
			if (this.mouse && key !== "mouse") this.mouse[1] = transform.invert(this.mouse[0]);
			if (this.touch0 && key !== "touch") this.touch0[1] = transform.invert(this.touch0[0]);
			if (this.touch1 && key !== "touch") this.touch1[1] = transform.invert(this.touch1[0]);
			this.that.__zoom = transform;
			this.emit("zoom");
			return this;
		},
		end: function() {
			if (--this.active === 0) {
				delete this.that.__zooming;
				this.emit("end");
			}
			return this;
		},
		emit: function(type) {
			var d = select_default$1(this.that).datum();
			listeners.call(type, this.that, new ZoomEvent(type, {
				sourceEvent: this.sourceEvent,
				target: zoom,
				type,
				transform: this.that.__zoom,
				dispatch: listeners
			}), d);
		}
	};
	function wheeled(event, ...args) {
		if (!filter.apply(this, arguments)) return;
		var g = gesture(this, args).event(event), t = this.__zoom, k = Math.max(scaleExtent[0], Math.min(scaleExtent[1], t.k * Math.pow(2, wheelDelta.apply(this, arguments)))), p = pointer_default(event);
		if (g.wheel) {
			if (g.mouse[0][0] !== p[0] || g.mouse[0][1] !== p[1]) g.mouse[1] = t.invert(g.mouse[0] = p);
			clearTimeout(g.wheel);
		} else if (t.k === k) return;
		else {
			g.mouse = [p, t.invert(p)];
			interrupt_default$1(this);
			g.start();
		}
		noevent_default(event);
		g.wheel = setTimeout(wheelidled, wheelDelay);
		g.zoom("mouse", constrain(translate(scale(t, k), g.mouse[0], g.mouse[1]), g.extent, translateExtent));
		function wheelidled() {
			g.wheel = null;
			g.end();
		}
	}
	function mousedowned(event, ...args) {
		if (touchending || !filter.apply(this, arguments)) return;
		var currentTarget = event.currentTarget, g = gesture(this, args, true).event(event), v = select_default$1(event.view).on("mousemove.zoom", mousemoved, true).on("mouseup.zoom", mouseupped, true), p = pointer_default(event, currentTarget), x0 = event.clientX, y0 = event.clientY;
		nodrag_default(event.view);
		nopropagation(event);
		g.mouse = [p, this.__zoom.invert(p)];
		interrupt_default$1(this);
		g.start();
		function mousemoved(event) {
			noevent_default(event);
			if (!g.moved) {
				var dx = event.clientX - x0, dy = event.clientY - y0;
				g.moved = dx * dx + dy * dy > clickDistance2;
			}
			g.event(event).zoom("mouse", constrain(translate(g.that.__zoom, g.mouse[0] = pointer_default(event, currentTarget), g.mouse[1]), g.extent, translateExtent));
		}
		function mouseupped(event) {
			v.on("mousemove.zoom mouseup.zoom", null);
			yesdrag(event.view, g.moved);
			noevent_default(event);
			g.event(event).end();
		}
	}
	function dblclicked(event, ...args) {
		if (!filter.apply(this, arguments)) return;
		var t0 = this.__zoom, p0 = pointer_default(event.changedTouches ? event.changedTouches[0] : event, this), p1 = t0.invert(p0), k1 = t0.k * (event.shiftKey ? .5 : 2), t1 = constrain(translate(scale(t0, k1), p0, p1), extent.apply(this, args), translateExtent);
		noevent_default(event);
		if (duration > 0) select_default$1(this).transition().duration(duration).call(schedule, t1, p0, event);
		else select_default$1(this).call(zoom.transform, t1, p0, event);
	}
	function touchstarted(event, ...args) {
		if (!filter.apply(this, arguments)) return;
		var touches = event.touches, n = touches.length, g = gesture(this, args, event.changedTouches.length === n).event(event), started, i, t, p;
		nopropagation(event);
		for (i = 0; i < n; ++i) {
			t = touches[i], p = pointer_default(t, this);
			p = [
				p,
				this.__zoom.invert(p),
				t.identifier
			];
			if (!g.touch0) g.touch0 = p, started = true, g.taps = 1 + !!touchstarting;
			else if (!g.touch1 && g.touch0[2] !== p[2]) g.touch1 = p, g.taps = 0;
		}
		if (touchstarting) touchstarting = clearTimeout(touchstarting);
		if (started) {
			if (g.taps < 2) touchfirst = p[0], touchstarting = setTimeout(function() {
				touchstarting = null;
			}, touchDelay);
			interrupt_default$1(this);
			g.start();
		}
	}
	function touchmoved(event, ...args) {
		if (!this.__zooming) return;
		var g = gesture(this, args).event(event), touches = event.changedTouches, n = touches.length, i, t, p, l;
		noevent_default(event);
		for (i = 0; i < n; ++i) {
			t = touches[i], p = pointer_default(t, this);
			if (g.touch0 && g.touch0[2] === t.identifier) g.touch0[0] = p;
			else if (g.touch1 && g.touch1[2] === t.identifier) g.touch1[0] = p;
		}
		t = g.that.__zoom;
		if (g.touch1) {
			var p0 = g.touch0[0], l0 = g.touch0[1], p1 = g.touch1[0], l1 = g.touch1[1], dp = (dp = p1[0] - p0[0]) * dp + (dp = p1[1] - p0[1]) * dp, dl = (dl = l1[0] - l0[0]) * dl + (dl = l1[1] - l0[1]) * dl;
			t = scale(t, Math.sqrt(dp / dl));
			p = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
			l = [(l0[0] + l1[0]) / 2, (l0[1] + l1[1]) / 2];
		} else if (g.touch0) p = g.touch0[0], l = g.touch0[1];
		else return;
		g.zoom("touch", constrain(translate(t, p, l), g.extent, translateExtent));
	}
	function touchended(event, ...args) {
		if (!this.__zooming) return;
		var g = gesture(this, args).event(event), touches = event.changedTouches, n = touches.length, i, t;
		nopropagation(event);
		if (touchending) clearTimeout(touchending);
		touchending = setTimeout(function() {
			touchending = null;
		}, touchDelay);
		for (i = 0; i < n; ++i) {
			t = touches[i];
			if (g.touch0 && g.touch0[2] === t.identifier) delete g.touch0;
			else if (g.touch1 && g.touch1[2] === t.identifier) delete g.touch1;
		}
		if (g.touch1 && !g.touch0) g.touch0 = g.touch1, delete g.touch1;
		if (g.touch0) g.touch0[1] = this.__zoom.invert(g.touch0[0]);
		else {
			g.end();
			if (g.taps === 2) {
				t = pointer_default(t, this);
				if (Math.hypot(touchfirst[0] - t[0], touchfirst[1] - t[1]) < tapDistance) {
					var p = select_default$1(this).on("dblclick.zoom");
					if (p) p.apply(this, arguments);
				}
			}
		}
	}
	zoom.wheelDelta = function(_) {
		return arguments.length ? (wheelDelta = typeof _ === "function" ? _ : constant_default(+_), zoom) : wheelDelta;
	};
	zoom.filter = function(_) {
		return arguments.length ? (filter = typeof _ === "function" ? _ : constant_default(!!_), zoom) : filter;
	};
	zoom.touchable = function(_) {
		return arguments.length ? (touchable = typeof _ === "function" ? _ : constant_default(!!_), zoom) : touchable;
	};
	zoom.extent = function(_) {
		return arguments.length ? (extent = typeof _ === "function" ? _ : constant_default([[+_[0][0], +_[0][1]], [+_[1][0], +_[1][1]]]), zoom) : extent;
	};
	zoom.scaleExtent = function(_) {
		return arguments.length ? (scaleExtent[0] = +_[0], scaleExtent[1] = +_[1], zoom) : [scaleExtent[0], scaleExtent[1]];
	};
	zoom.translateExtent = function(_) {
		return arguments.length ? (translateExtent[0][0] = +_[0][0], translateExtent[1][0] = +_[1][0], translateExtent[0][1] = +_[0][1], translateExtent[1][1] = +_[1][1], zoom) : [[translateExtent[0][0], translateExtent[0][1]], [translateExtent[1][0], translateExtent[1][1]]];
	};
	zoom.constrain = function(_) {
		return arguments.length ? (constrain = _, zoom) : constrain;
	};
	zoom.duration = function(_) {
		return arguments.length ? (duration = +_, zoom) : duration;
	};
	zoom.interpolate = function(_) {
		return arguments.length ? (interpolate = _, zoom) : interpolate;
	};
	zoom.on = function() {
		var value = listeners.on.apply(listeners, arguments);
		return value === listeners ? zoom : value;
	};
	zoom.clickDistance = function(_) {
		return arguments.length ? (clickDistance2 = (_ = +_) * _, zoom) : Math.sqrt(clickDistance2);
	};
	zoom.tapDistance = function(_) {
		return arguments.length ? (tapDistance = +_, zoom) : tapDistance;
	};
	return zoom;
}
//#endregion
//#region
var errorMessages = {
	error001: (lib = "react") => `Seems like you have not used ${lib === "svelte" ? "SvelteFlowProvider" : "ReactFlowProvider"} as an ancestor. Help: https://${lib}flow.dev/error#001`,
	error002: () => "It looks like you've created a new nodeTypes or edgeTypes object. If this wasn't on purpose please define the nodeTypes/edgeTypes outside of the component or memoize them.",
	error003: (nodeType) => `Node type "${nodeType}" not found. Using fallback type "default".`,
	error004: () => "The parent container needs a width and a height to render the graph.",
	error005: () => "Only child nodes can use a parent extent.",
	error006: () => "Can't create edge. An edge needs a source and a target.",
	error007: (id) => `The old edge with id=${id} does not exist.`,
	error009: (type) => `Marker type "${type}" doesn't exist.`,
	error008: (handleType, { id, sourceHandle, targetHandle }) => `Couldn't create edge for ${handleType} handle id: "${handleType === "source" ? sourceHandle : targetHandle}", edge id: ${id}.`,
	error010: () => "Handle: No node id found. Make sure to only use a Handle inside a custom Node.",
	error011: (edgeType) => `Edge type "${edgeType}" not found. Using fallback type "default".`,
	error012: (id) => `Node with id "${id}" does not exist, it may have been removed. This can happen when a node is deleted before the "onNodeClick" handler is called.`,
	error013: (lib = "react") => `It seems that you haven't loaded the styles. Please import '@xyflow/${lib}/dist/style.css' or base.css to make sure everything is working properly.`,
	error014: () => "useNodeConnections: No node ID found. Call useNodeConnections inside a custom Node or provide a node ID.",
	error015: () => "It seems that you are trying to drag a node that is not initialized. Please use onNodesChange as explained in the docs.",
	error016: (id) => `Edge with id "${id}" does not exist, it may have been removed. This can happen when an edge is deleted before the "onEdgeClick" handler is called.`
};
var infiniteExtent = [[Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY], [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]];
var elementSelectionKeys = [
	"Enter",
	" ",
	"Escape"
];
var defaultAriaLabelConfig = {
	"node.a11yDescription.default": "Press enter or space to select a node. Press delete to remove it and escape to cancel.",
	"node.a11yDescription.keyboardDisabled": "Press enter or space to select a node. You can then use the arrow keys to move the node around. Press delete to remove it and escape to cancel.",
	"node.a11yDescription.ariaLiveMessage": ({ direction, x, y }) => `Moved selected node ${direction}. New position, x: ${x}, y: ${y}`,
	"edge.a11yDescription.default": "Press enter or space to select an edge. You can then press delete to remove it or escape to cancel.",
	"controls.ariaLabel": "Control Panel",
	"controls.zoomIn.ariaLabel": "Zoom In",
	"controls.zoomOut.ariaLabel": "Zoom Out",
	"controls.fitView.ariaLabel": "Fit View",
	"controls.interactive.ariaLabel": "Toggle Interactivity",
	"minimap.ariaLabel": "Mini Map",
	"handle.ariaLabel": "Handle"
};
/**
* The `ConnectionMode` is used to set the mode of connection between nodes.
* The `Strict` mode is the default one and only allows source to target edges.
* `Loose` mode allows source to source and target to target edges as well.
*
* @public
*/
var ConnectionMode;
(function(ConnectionMode) {
	ConnectionMode["Strict"] = "strict";
	ConnectionMode["Loose"] = "loose";
})(ConnectionMode || (ConnectionMode = {}));
/**
* This enum is used to set the different modes of panning the viewport when the
* user scrolls. The `Free` mode allows the user to pan in any direction by scrolling
* with a device like a trackpad. The `Vertical` and `Horizontal` modes restrict
* scroll panning to only the vertical or horizontal axis, respectively.
*
* @public
*/
var PanOnScrollMode;
(function(PanOnScrollMode) {
	PanOnScrollMode["Free"] = "free";
	PanOnScrollMode["Vertical"] = "vertical";
	PanOnScrollMode["Horizontal"] = "horizontal";
})(PanOnScrollMode || (PanOnScrollMode = {}));
var SelectionMode;
(function(SelectionMode) {
	SelectionMode["Partial"] = "partial";
	SelectionMode["Full"] = "full";
})(SelectionMode || (SelectionMode = {}));
var initialConnection = {
	inProgress: false,
	isValid: null,
	from: null,
	fromHandle: null,
	fromPosition: null,
	fromNode: null,
	to: null,
	toHandle: null,
	toPosition: null,
	toNode: null,
	pointer: null
};
/**
* If you set the `connectionLineType` prop on your [`<ReactFlow />`](/api-reference/react-flow#connection-connectionLineType)
*component, it will dictate the style of connection line rendered when creating
*new edges.
*
* @public
*
* @remarks If you choose to render a custom connection line component, this value will be
*passed to your component as part of its [`ConnectionLineComponentProps`](/api-reference/types/connection-line-component-props).
*/
var ConnectionLineType;
(function(ConnectionLineType) {
	ConnectionLineType["Bezier"] = "default";
	ConnectionLineType["Straight"] = "straight";
	ConnectionLineType["Step"] = "step";
	ConnectionLineType["SmoothStep"] = "smoothstep";
	ConnectionLineType["SimpleBezier"] = "simplebezier";
})(ConnectionLineType || (ConnectionLineType = {}));
/**
* Edges may optionally have a marker on either end. The MarkerType type enumerates
* the options available to you when configuring a given marker.
*
* @public
*/
var MarkerType;
(function(MarkerType) {
	MarkerType["Arrow"] = "arrow";
	MarkerType["ArrowClosed"] = "arrowclosed";
})(MarkerType || (MarkerType = {}));
/**
* While [`PanelPosition`](/api-reference/types/panel-position) can be used to place a
* component in the corners of a container, the `Position` enum is less precise and used
* primarily in relation to edges and handles.
*
* @public
*/
var Position;
(function(Position) {
	Position["Left"] = "left";
	Position["Top"] = "top";
	Position["Right"] = "right";
	Position["Bottom"] = "bottom";
})(Position || (Position = {}));
var oppositePosition = {
	[Position.Left]: Position.Right,
	[Position.Right]: Position.Left,
	[Position.Top]: Position.Bottom,
	[Position.Bottom]: Position.Top
};
/**
* Test whether an object is usable as an Edge
* @public
* @remarks In TypeScript this is a type guard that will narrow the type of whatever you pass in to Edge if it returns true
* @param element - The element to test
* @returns A boolean indicating whether the element is an Edge
*/
var isEdgeBase = (element) => !!element && typeof element === "object" && "id" in element && "source" in element && "target" in element;
/**
* Test whether an object is usable as a Node
* @public
* @remarks In TypeScript this is a type guard that will narrow the type of whatever you pass in to Node if it returns true
* @param element - The element to test
* @returns A boolean indicating whether the element is an Node
*/
var isNodeBase = (element) => !!element && typeof element === "object" && "id" in element && "position" in element && !("source" in element) && !("target" in element);
var isInternalNodeBase = (element) => !!element && typeof element === "object" && "id" in element && "internals" in element && !("source" in element) && !("target" in element);
var getNodePositionWithOrigin = (node, nodeOrigin = [0, 0]) => {
	const { width, height } = getNodeDimensions(node);
	const origin = node.origin ?? nodeOrigin;
	const offsetX = width * origin[0];
	const offsetY = height * origin[1];
	return {
		x: node.position.x - offsetX,
		y: node.position.y - offsetY
	};
};
/**
* Returns the bounding box that contains all the given nodes in an array. This can
* be useful when combined with [`getViewportForBounds`](/api-reference/utils/get-viewport-for-bounds)
* to calculate the correct transform to fit the given nodes in a viewport.
* @public
* @remarks Useful when combined with {@link getViewportForBounds} to calculate the correct transform to fit the given nodes in a viewport.
* @param nodes - Nodes to calculate the bounds for.
* @returns Bounding box enclosing all nodes.
*
* @remarks This function was previously called `getRectOfNodes`
*
* @example
* ```js
*import { getNodesBounds } from '@xyflow/react';
*
*const nodes = [
*  {
*    id: 'a',
*    position: { x: 0, y: 0 },
*    data: { label: 'a' },
*    width: 50,
*    height: 25,
*  },
*  {
*    id: 'b',
*    position: { x: 100, y: 100 },
*    data: { label: 'b' },
*    width: 50,
*    height: 25,
*  },
*];
*
*const bounds = getNodesBounds(nodes);
*```
*/
var getNodesBounds = (nodes, params = { nodeOrigin: [0, 0] }) => {
	if (nodes.length === 0) return {
		x: 0,
		y: 0,
		width: 0,
		height: 0
	};
	let hasNode = false;
	const box = nodes.reduce((currBox, nodeOrId) => {
		const isId = typeof nodeOrId === "string";
		let currentNode = !params.nodeLookup && !isId ? nodeOrId : void 0;
		if (params.nodeLookup) currentNode = isId ? params.nodeLookup.get(nodeOrId) : !isInternalNodeBase(nodeOrId) ? params.nodeLookup.get(nodeOrId.id) : nodeOrId;
		if (!currentNode) return currBox;
		hasNode = true;
		return getBoundsOfBoxes(currBox, nodeToBox(currentNode, params.nodeOrigin));
	}, {
		x: Infinity,
		y: Infinity,
		x2: -Infinity,
		y2: -Infinity
	});
	return hasNode ? boxToRect(box) : {
		x: 0,
		y: 0,
		width: 0,
		height: 0
	};
};
/**
* Determines a bounding box that contains all given nodes in an array
* @internal
*/
var getInternalNodesBounds = (nodeLookup, params = {}) => {
	let box = {
		x: Infinity,
		y: Infinity,
		x2: -Infinity,
		y2: -Infinity
	};
	let hasVisibleNodes = false;
	nodeLookup.forEach((node) => {
		if (params.filter === void 0 || params.filter(node)) {
			box = getBoundsOfBoxes(box, nodeToBox(node));
			hasVisibleNodes = true;
		}
	});
	return hasVisibleNodes ? boxToRect(box) : {
		x: 0,
		y: 0,
		width: 0,
		height: 0
	};
};
var getNodesInside = (nodes, rect, [tx, ty, tScale] = [
	0,
	0,
	1
], partially = false, excludeNonSelectableNodes = false) => {
	const paneX = (rect.x - tx) / tScale;
	const paneY = (rect.y - ty) / tScale;
	const paneWidth = rect.width / tScale;
	const paneHeight = rect.height / tScale;
	const visibleNodes = [];
	for (const node of nodes.values()) {
		const { measured, selectable = true, hidden = false } = node;
		if (excludeNonSelectableNodes && !selectable || hidden) continue;
		const width = measured.width ?? node.width ?? node.initialWidth ?? 0;
		const height = measured.height ?? node.height ?? node.initialHeight ?? 0;
		const { x, y } = node.internals.positionAbsolute;
		const overlappingArea = getRectsOverlappingArea(paneX, paneY, paneWidth, paneHeight, x, y, width, height);
		const area = width * height;
		const partiallyVisible = partially && overlappingArea > 0;
		if (!node.internals.handleBounds || partiallyVisible || overlappingArea >= area || node.dragging) visibleNodes.push(node);
	}
	return visibleNodes;
};
/**
* This utility filters an array of edges, keeping only those where either the source or target
* node is present in the given array of nodes.
* @public
* @param nodes - Nodes you want to get the connected edges for.
* @param edges - All edges.
* @returns Array of edges that connect any of the given nodes with each other.
*
* @example
* ```js
*import { getConnectedEdges } from '@xyflow/react';
*
*const nodes = [
*  { id: 'a', position: { x: 0, y: 0 } },
*  { id: 'b', position: { x: 100, y: 0 } },
*];
*
*const edges = [
*  { id: 'a->c', source: 'a', target: 'c' },
*  { id: 'c->d', source: 'c', target: 'd' },
*];
*
*const connectedEdges = getConnectedEdges(nodes, edges);
* // => [{ id: 'a->c', source: 'a', target: 'c' }]
*```
*/
var getConnectedEdges = (nodes, edges) => {
	const nodeIds = /* @__PURE__ */ new Set();
	nodes.forEach((node) => {
		nodeIds.add(node.id);
	});
	return edges.filter((edge) => nodeIds.has(edge.source) || nodeIds.has(edge.target));
};
function getFitViewNodes(nodeLookup, options) {
	const fitViewNodes = /* @__PURE__ */ new Map();
	const optionNodeIds = options?.nodes ? new Set(options.nodes.map((node) => node.id)) : null;
	nodeLookup.forEach((n) => {
		let isVisible;
		if (options?.includeHiddenNodes) {
			const { width, height } = getNodeDimensions(n);
			isVisible = width > 0 && height > 0;
		} else isVisible = Boolean(n.measured.width && n.measured.height && !n.hidden);
		if (isVisible && (!optionNodeIds || optionNodeIds.has(n.id))) fitViewNodes.set(n.id, n);
	});
	return fitViewNodes;
}
async function fitViewport({ nodes, width, height, panZoom, minZoom, maxZoom }, options) {
	if (nodes.size === 0) return true;
	const viewport = getViewportForBounds(getInternalNodesBounds(getFitViewNodes(nodes, options)), width, height, options?.minZoom ?? minZoom, options?.maxZoom ?? maxZoom, options?.padding ?? .1);
	await panZoom.setViewport(viewport, {
		duration: options?.duration,
		ease: options?.ease,
		interpolate: options?.interpolate
	});
	return true;
}
/**
* This function calculates the next position of a node, taking into account the node's extent, parent node, and origin.
*
* @internal
* @returns position, positionAbsolute
*/
function calculateNodePosition({ nodeId, nextPosition, nodeLookup, nodeOrigin = [0, 0], nodeExtent, onError }) {
	const node = nodeLookup.get(nodeId);
	const parentNode = node.parentId ? nodeLookup.get(node.parentId) : void 0;
	const { x: parentX, y: parentY } = parentNode ? parentNode.internals.positionAbsolute : {
		x: 0,
		y: 0
	};
	const origin = node.origin ?? nodeOrigin;
	let extent = node.extent || nodeExtent;
	if (node.extent === "parent" && !node.expandParent) {
		if (!parentNode) onError?.("005", errorMessages["error005"]());
		else {
			const { width: parentWidth, height: parentHeight } = getNodeDimensions(parentNode);
			if (parentWidth && parentHeight) extent = [[parentX, parentY], [parentX + parentWidth, parentY + parentHeight]];
		}
	} else if (parentNode && isCoordinateExtent(node.extent)) extent = [[node.extent[0][0] + parentX, node.extent[0][1] + parentY], [node.extent[1][0] + parentX, node.extent[1][1] + parentY]];
	const positionAbsolute = isCoordinateExtent(extent) ? clampPosition(nextPosition, extent, node.measured) : nextPosition;
	if (node.measured.width === void 0 || node.measured.height === void 0) onError?.("015", errorMessages["error015"]());
	return {
		position: {
			x: positionAbsolute.x - parentX + (node.measured.width ?? 0) * origin[0],
			y: positionAbsolute.y - parentY + (node.measured.height ?? 0) * origin[1]
		},
		positionAbsolute
	};
}
/**
* Pass in nodes & edges to delete, get arrays of nodes and edges that actually can be deleted
* @internal
* @param param.nodesToRemove - The nodes to remove
* @param param.edgesToRemove - The edges to remove
* @param param.nodes - All nodes
* @param param.edges - All edges
* @param param.onBeforeDelete - Callback to check which nodes and edges can be deleted
* @returns nodes: nodes that can be deleted, edges: edges that can be deleted
*/
async function getElementsToRemove({ nodesToRemove = [], edgesToRemove = [], nodes, edges, onBeforeDelete }) {
	const nodeIds = new Set(nodesToRemove.map((node) => node.id));
	const matchingNodes = [];
	for (const node of nodes) {
		if (node.deletable === false) continue;
		const isIncluded = nodeIds.has(node.id);
		const parentHit = !isIncluded && node.parentId && matchingNodes.find((n) => n.id === node.parentId);
		if (isIncluded || parentHit) matchingNodes.push(node);
	}
	const edgeIds = new Set(edgesToRemove.map((edge) => edge.id));
	const deletableEdges = edges.filter((edge) => edge.deletable !== false);
	const matchingEdges = getConnectedEdges(matchingNodes, deletableEdges);
	for (const edge of deletableEdges) if (edgeIds.has(edge.id) && !matchingEdges.find((e) => e.id === edge.id)) matchingEdges.push(edge);
	if (!onBeforeDelete) return {
		edges: matchingEdges,
		nodes: matchingNodes
	};
	const onBeforeDeleteResult = await onBeforeDelete({
		nodes: matchingNodes,
		edges: matchingEdges
	});
	if (typeof onBeforeDeleteResult === "boolean") return onBeforeDeleteResult ? {
		edges: matchingEdges,
		nodes: matchingNodes
	} : {
		edges: [],
		nodes: []
	};
	return onBeforeDeleteResult;
}
var clamp = (val, min = 0, max = 1) => Math.min(Math.max(val, min), max);
var clampPosition = (position = {
	x: 0,
	y: 0
}, extent, dimensions) => ({
	x: clamp(position.x, extent[0][0], extent[1][0] - (dimensions?.width ?? 0)),
	y: clamp(position.y, extent[0][1], extent[1][1] - (dimensions?.height ?? 0))
});
function clampPositionToParent(childPosition, childDimensions, parent) {
	const { width: parentWidth, height: parentHeight } = getNodeDimensions(parent);
	const { x: parentX, y: parentY } = parent.internals.positionAbsolute;
	return clampPosition(childPosition, [[parentX, parentY], [parentX + parentWidth, parentY + parentHeight]], childDimensions);
}
/**
* Calculates the velocity of panning when the mouse is close to the edge of the canvas
* @internal
* @param value - One dimensional poition of the mouse (x or y)
* @param min - Minimal position on canvas before panning starts
* @param max - Maximal position on canvas before panning starts
* @returns - A number between 0 and 1 that represents the velocity of panning
*/
var calcAutoPanVelocity = (value, min, max) => {
	if (value < min) return clamp(Math.abs(value - min), 1, min) / min;
	else if (value > max) return -clamp(Math.abs(value - max), 1, min) / min;
	return 0;
};
var calcAutoPan = (pos, bounds, speed = 15, distance = 40) => {
	return [calcAutoPanVelocity(pos.x, distance, bounds.width - distance) * speed, calcAutoPanVelocity(pos.y, distance, bounds.height - distance) * speed];
};
var getBoundsOfBoxes = (box1, box2) => ({
	x: Math.min(box1.x, box2.x),
	y: Math.min(box1.y, box2.y),
	x2: Math.max(box1.x2, box2.x2),
	y2: Math.max(box1.y2, box2.y2)
});
var rectToBox = ({ x, y, width, height }) => ({
	x,
	y,
	x2: x + width,
	y2: y + height
});
var boxToRect = ({ x, y, x2, y2 }) => ({
	x,
	y,
	width: x2 - x,
	height: y2 - y
});
var nodeToRect = (node, nodeOrigin = [0, 0]) => {
	const { x, y } = isInternalNodeBase(node) ? node.internals.positionAbsolute : getNodePositionWithOrigin(node, nodeOrigin);
	return {
		x,
		y,
		width: node.measured?.width ?? node.width ?? node.initialWidth ?? 0,
		height: node.measured?.height ?? node.height ?? node.initialHeight ?? 0
	};
};
var nodeToBox = (node, nodeOrigin = [0, 0]) => {
	const { x, y } = isInternalNodeBase(node) ? node.internals.positionAbsolute : getNodePositionWithOrigin(node, nodeOrigin);
	return {
		x,
		y,
		x2: x + (node.measured?.width ?? node.width ?? node.initialWidth ?? 0),
		y2: y + (node.measured?.height ?? node.height ?? node.initialHeight ?? 0)
	};
};
var getBoundsOfRects = (rect1, rect2) => boxToRect(getBoundsOfBoxes(rectToBox(rect1), rectToBox(rect2)));
var getRectsOverlappingArea = (aX, aY, aWidth, aHeight, bX, bY, bWidth, bHeight) => {
	const xOverlap = Math.max(0, Math.min(aX + aWidth, bX + bWidth) - Math.max(aX, bX));
	const yOverlap = Math.max(0, Math.min(aY + aHeight, bY + bHeight) - Math.max(aY, bY));
	return Math.ceil(xOverlap * yOverlap);
};
var getOverlappingArea = (rectA, rectB) => getRectsOverlappingArea(rectA.x, rectA.y, rectA.width, rectA.height, rectB.x, rectB.y, rectB.width, rectB.height);
var isRectObject = (obj) => isNumeric(obj.width) && isNumeric(obj.height) && isNumeric(obj.x) && isNumeric(obj.y);
var isNumeric = (n) => !isNaN(n) && isFinite(n);
var createDevWarn = (lib, helpUrl) => (id, message) => {};
var snapPosition = (position, snapGrid = [1, 1]) => {
	return {
		x: snapGrid[0] * Math.round(position.x / snapGrid[0]),
		y: snapGrid[1] * Math.round(position.y / snapGrid[1])
	};
};
var pointToRendererPoint = ({ x, y }, [tx, ty, tScale], snapToGrid = false, snapGrid = [1, 1]) => {
	const position = {
		x: (x - tx) / tScale,
		y: (y - ty) / tScale
	};
	return snapToGrid ? snapPosition(position, snapGrid) : position;
};
var rendererPointToPoint = ({ x, y }, [tx, ty, tScale]) => {
	return {
		x: x * tScale + tx,
		y: y * tScale + ty
	};
};
/**
* Parses a single padding value to a number
* @internal
* @param padding - Padding to parse
* @param viewport - Width or height of the viewport
* @returns The padding in pixels
*/
function parsePadding(padding, viewport) {
	if (typeof padding === "number") return Math.floor((viewport - viewport / (1 + padding)) * .5);
	if (typeof padding === "string" && padding.endsWith("px")) {
		const paddingValue = parseFloat(padding);
		if (!Number.isNaN(paddingValue)) return Math.floor(paddingValue);
	}
	if (typeof padding === "string" && padding.endsWith("%")) {
		const paddingValue = parseFloat(padding);
		if (!Number.isNaN(paddingValue)) return Math.floor(viewport * paddingValue * .01);
	}
	console.error(`The padding value "${padding}" is invalid. Please provide a number or a string with a valid unit (px or %).`);
	return 0;
}
/**
* Parses the paddings to an object with top, right, bottom, left, x and y paddings
* @internal
* @param padding - Padding to parse
* @param width - Width of the viewport
* @param height - Height of the viewport
* @returns An object with the paddings in pixels
*/
function parsePaddings(padding, width, height) {
	if (typeof padding === "string" || typeof padding === "number") {
		const paddingY = parsePadding(padding, height);
		const paddingX = parsePadding(padding, width);
		return {
			top: paddingY,
			right: paddingX,
			bottom: paddingY,
			left: paddingX,
			x: paddingX * 2,
			y: paddingY * 2
		};
	}
	if (typeof padding === "object") {
		const top = parsePadding(padding.top ?? padding.y ?? 0, height);
		const bottom = parsePadding(padding.bottom ?? padding.y ?? 0, height);
		const left = parsePadding(padding.left ?? padding.x ?? 0, width);
		const right = parsePadding(padding.right ?? padding.x ?? 0, width);
		return {
			top,
			right,
			bottom,
			left,
			x: left + right,
			y: top + bottom
		};
	}
	return {
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		x: 0,
		y: 0
	};
}
/**
* Calculates the resulting paddings if the new viewport is applied
* @internal
* @param bounds - Bounds to fit inside viewport
* @param x - X position of the viewport
* @param y - Y position of the viewport
* @param zoom - Zoom level of the viewport
* @param width - Width of the viewport
* @param height - Height of the viewport
* @returns An object with the minimum padding required to fit the bounds inside the viewport
*/
function calculateAppliedPaddings(bounds, x, y, zoom, width, height) {
	const { x: left, y: top } = rendererPointToPoint(bounds, [
		x,
		y,
		zoom
	]);
	const { x: boundRight, y: boundBottom } = rendererPointToPoint({
		x: bounds.x + bounds.width,
		y: bounds.y + bounds.height
	}, [
		x,
		y,
		zoom
	]);
	const right = width - boundRight;
	const bottom = height - boundBottom;
	return {
		left: Math.floor(left),
		top: Math.floor(top),
		right: Math.floor(right),
		bottom: Math.floor(bottom)
	};
}
/**
* Returns a viewport that encloses the given bounds with padding.
* @public
* @remarks You can determine bounds of nodes with {@link getNodesBounds} and {@link getBoundsOfRects}
* @param bounds - Bounds to fit inside viewport.
* @param width - Width of the viewport.
* @param height  - Height of the viewport.
* @param minZoom - Minimum zoom level of the resulting viewport.
* @param maxZoom - Maximum zoom level of the resulting viewport.
* @param padding - Padding around the bounds.
* @returns A transformed {@link Viewport} that encloses the given bounds which you can pass to e.g. {@link setViewport}.
* @example
* const { x, y, zoom } = getViewportForBounds(
* { x: 0, y: 0, width: 100, height: 100},
* 1200, 800, 0.5, 2);
*/
var getViewportForBounds = (bounds, width, height, minZoom, maxZoom, padding) => {
	const p = parsePaddings(padding, width, height);
	const xZoom = (width - p.x) / bounds.width;
	const yZoom = (height - p.y) / bounds.height;
	const clampedZoom = clamp(Math.min(xZoom, yZoom), minZoom, maxZoom);
	const boundsCenterX = bounds.x + bounds.width / 2;
	const boundsCenterY = bounds.y + bounds.height / 2;
	const x = width / 2 - boundsCenterX * clampedZoom;
	const y = height / 2 - boundsCenterY * clampedZoom;
	const newPadding = calculateAppliedPaddings(bounds, x, y, clampedZoom, width, height);
	const offset = {
		left: Math.min(newPadding.left - p.left, 0),
		top: Math.min(newPadding.top - p.top, 0),
		right: Math.min(newPadding.right - p.right, 0),
		bottom: Math.min(newPadding.bottom - p.bottom, 0)
	};
	return {
		x: x - offset.left + offset.right,
		y: y - offset.top + offset.bottom,
		zoom: clampedZoom
	};
};
var isMacOs = () => typeof navigator !== "undefined" && navigator?.userAgent?.indexOf("Mac") >= 0;
function isCoordinateExtent(extent) {
	return extent !== void 0 && extent !== null && extent !== "parent";
}
function getNodeDimensions(node) {
	return {
		width: node.measured?.width ?? node.width ?? node.initialWidth ?? 0,
		height: node.measured?.height ?? node.height ?? node.initialHeight ?? 0
	};
}
function nodeHasDimensions(node) {
	return (node.measured?.width ?? node.width ?? node.initialWidth) !== void 0 && (node.measured?.height ?? node.height ?? node.initialHeight) !== void 0;
}
/**
* Convert child position to absolute position
*
* @internal
* @param position
* @param parentId
* @param nodeLookup
* @param nodeOrigin
* @returns an internal node with an absolute position
*/
function evaluateAbsolutePosition(position, dimensions = {
	width: 0,
	height: 0
}, parentId, nodeLookup, nodeOrigin) {
	const positionAbsolute = { ...position };
	const parent = nodeLookup.get(parentId);
	if (parent) {
		const origin = parent.origin || nodeOrigin;
		positionAbsolute.x += parent.internals.positionAbsolute.x - (dimensions.width ?? 0) * origin[0];
		positionAbsolute.y += parent.internals.positionAbsolute.y - (dimensions.height ?? 0) * origin[1];
	}
	return positionAbsolute;
}
function areSetsEqual(a, b) {
	if (a.size !== b.size) return false;
	for (const item of a) if (!b.has(item)) return false;
	return true;
}
/**
* Polyfill for Promise.withResolvers until we can use it in all browsers
* @internal
*/
function withResolvers() {
	let resolve;
	let reject;
	return {
		promise: new Promise((res, rej) => {
			resolve = res;
			reject = rej;
		}),
		resolve,
		reject
	};
}
function mergeAriaLabelConfig(partial) {
	return {
		...defaultAriaLabelConfig,
		...partial || {}
	};
}
function getConnectionStatus(isValid) {
	return isValid === null ? null : isValid ? "valid" : "invalid";
}
function getPointerPosition(event, { snapGrid = [0, 0], snapToGrid = false, transform, containerBounds }) {
	const { x, y } = getEventPosition(event);
	const pointerPos = pointToRendererPoint({
		x: x - (containerBounds?.left ?? 0),
		y: y - (containerBounds?.top ?? 0)
	}, transform);
	const { x: xSnapped, y: ySnapped } = snapToGrid ? snapPosition(pointerPos, snapGrid) : pointerPos;
	return {
		xSnapped,
		ySnapped,
		...pointerPos
	};
}
var getDimensions = (node) => ({
	width: node.offsetWidth,
	height: node.offsetHeight
});
var getHostForElement = (element) => element?.getRootNode?.() || window?.document;
var inputTags = [
	"INPUT",
	"SELECT",
	"TEXTAREA"
];
function isInputDOMNode(event) {
	const target = event.composedPath?.()?.[0] || event.target;
	if (target?.nodeType !== 1) return false;
	return inputTags.includes(target.nodeName) || target.hasAttribute("contenteditable") || !!target.closest(".nokey");
}
var isMouseEvent = (event) => "clientX" in event;
var getEventPosition = (event, bounds) => {
	const isMouse = isMouseEvent(event);
	const evtX = isMouse ? event.clientX : event.touches?.[0].clientX;
	const evtY = isMouse ? event.clientY : event.touches?.[0].clientY;
	return {
		x: evtX - (bounds?.left ?? 0),
		y: evtY - (bounds?.top ?? 0)
	};
};
var getHandleBounds = (type, nodeElement, nodeBounds, zoom, nodeId) => {
	const handles = nodeElement.querySelectorAll(`.${type}`);
	if (!handles || !handles.length) return null;
	return Array.from(handles).map((handle) => {
		const handleBounds = handle.getBoundingClientRect();
		return {
			id: handle.getAttribute("data-handleid"),
			type,
			nodeId,
			position: handle.getAttribute("data-handlepos"),
			x: (handleBounds.left - nodeBounds.left) / zoom,
			y: (handleBounds.top - nodeBounds.top) / zoom,
			...getDimensions(handle)
		};
	});
};
function getBezierEdgeCenter({ sourceX, sourceY, targetX, targetY, sourceControlX, sourceControlY, targetControlX, targetControlY }) {
	const centerX = sourceX * .125 + sourceControlX * .375 + targetControlX * .375 + targetX * .125;
	const centerY = sourceY * .125 + sourceControlY * .375 + targetControlY * .375 + targetY * .125;
	return [
		centerX,
		centerY,
		Math.abs(centerX - sourceX),
		Math.abs(centerY - sourceY)
	];
}
function calculateControlOffset(distance, curvature) {
	if (distance >= 0) return .5 * distance;
	return curvature * 25 * Math.sqrt(-distance);
}
function getControlWithCurvature({ pos, x1, y1, x2, y2, c }) {
	switch (pos) {
		case Position.Left: return [x1 - calculateControlOffset(x1 - x2, c), y1];
		case Position.Right: return [x1 + calculateControlOffset(x2 - x1, c), y1];
		case Position.Top: return [x1, y1 - calculateControlOffset(y1 - y2, c)];
		case Position.Bottom: return [x1, y1 + calculateControlOffset(y2 - y1, c)];
	}
}
/**
* The `getBezierPath` util returns everything you need to render a bezier edge
*between two nodes.
* @public
* @returns A path string you can use in an SVG, the `labelX` and `labelY` position (center of path)
* and `offsetX`, `offsetY` between source handle and label.
* - `path`: the path to use in an SVG `<path>` element.
* - `labelX`: the `x` position you can use to render a label for this edge.
* - `labelY`: the `y` position you can use to render a label for this edge.
* - `offsetX`: the absolute difference between the source `x` position and the `x` position of the
* middle of this path.
* - `offsetY`: the absolute difference between the source `y` position and the `y` position of the
* middle of this path.
* @example
* ```js
*  const source = { x: 0, y: 20 };
*  const target = { x: 150, y: 100 };
*
*  const [path, labelX, labelY, offsetX, offsetY] = getBezierPath({
*    sourceX: source.x,
*    sourceY: source.y,
*    sourcePosition: Position.Right,
*    targetX: target.x,
*    targetY: target.y,
*    targetPosition: Position.Left,
*});
*```
*
* @remarks This function returns a tuple (aka a fixed-size array) to make it easier to
*work with multiple edge paths at once.
*/
function getBezierPath({ sourceX, sourceY, sourcePosition = Position.Bottom, targetX, targetY, targetPosition = Position.Top, curvature = .25 }) {
	const [sourceControlX, sourceControlY] = getControlWithCurvature({
		pos: sourcePosition,
		x1: sourceX,
		y1: sourceY,
		x2: targetX,
		y2: targetY,
		c: curvature
	});
	const [targetControlX, targetControlY] = getControlWithCurvature({
		pos: targetPosition,
		x1: targetX,
		y1: targetY,
		x2: sourceX,
		y2: sourceY,
		c: curvature
	});
	const [labelX, labelY, offsetX, offsetY] = getBezierEdgeCenter({
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourceControlX,
		sourceControlY,
		targetControlX,
		targetControlY
	});
	return [
		`M${sourceX},${sourceY} C${sourceControlX},${sourceControlY} ${targetControlX},${targetControlY} ${targetX},${targetY}`,
		labelX,
		labelY,
		offsetX,
		offsetY
	];
}
function getEdgeCenter({ sourceX, sourceY, targetX, targetY }) {
	const xOffset = Math.abs(targetX - sourceX) / 2;
	const centerX = targetX < sourceX ? targetX + xOffset : targetX - xOffset;
	const yOffset = Math.abs(targetY - sourceY) / 2;
	return [
		centerX,
		targetY < sourceY ? targetY + yOffset : targetY - yOffset,
		xOffset,
		yOffset
	];
}
/**
* Returns the z-index for an edge based on the node it connects and whether it is selected.
* By default, edges are rendered below nodes. This behaviour is different for edges that are
* connected to nodes with a parent, as they are rendered above the parent node.
*/
function getElevatedEdgeZIndex({ sourceNode, targetNode, selected = false, zIndex = 0, elevateOnSelect = false, zIndexMode = "basic" }) {
	if (zIndexMode === "manual") return zIndex;
	return (elevateOnSelect && selected ? zIndex + 1e3 : zIndex) + Math.max(sourceNode.parentId || elevateOnSelect && sourceNode.selected ? sourceNode.internals.z : 0, targetNode.parentId || elevateOnSelect && targetNode.selected ? targetNode.internals.z : 0);
}
function isEdgeVisible({ sourceNode, targetNode, width, height, transform }) {
	const edgeBox = getBoundsOfBoxes(nodeToBox(sourceNode), nodeToBox(targetNode));
	if (edgeBox.x === edgeBox.x2) edgeBox.x2 += 1;
	if (edgeBox.y === edgeBox.y2) edgeBox.y2 += 1;
	return getOverlappingArea({
		x: -transform[0] / transform[2],
		y: -transform[1] / transform[2],
		width: width / transform[2],
		height: height / transform[2]
	}, boxToRect(edgeBox)) > 0;
}
/**
* The default edge ID generator function. Generates an ID based on the source, target, and handles.
* @public
* @param params - The connection or edge to generate an ID for.
* @returns The generated edge ID.
*/
var getEdgeId = ({ source, sourceHandle, target, targetHandle }) => `xy-edge__${source}${sourceHandle || ""}-${target}${targetHandle || ""}`;
var connectionExists = (edge, edges) => {
	return edges.some((el) => el.source === edge.source && el.target === edge.target && (el.sourceHandle === edge.sourceHandle || !el.sourceHandle && !edge.sourceHandle) && (el.targetHandle === edge.targetHandle || !el.targetHandle && !edge.targetHandle));
};
/**
* This util is a convenience function to add a new Edge to an array of edges. It also performs some validation to make sure you don't add an invalid edge or duplicate an existing one.
* @public
* @param edgeParams - Either an `Edge` or a `Connection` you want to add.
* @param edges - The array of all current edges.
* @param options - Optional configuration object.
* @returns A new array of edges with the new edge added.
*
* @remarks If an edge with the same `target` and `source` already exists (and the same
*`targetHandle` and `sourceHandle` if those are set), then this util won't add
*a new edge even if the `id` property is different.
*
*/
var addEdge$1 = (edgeParams, edges, options = {}) => {
	if (!edgeParams.source || !edgeParams.target) {
		options.onError?.("006", errorMessages["error006"]());
		return edges;
	}
	const edgeIdGenerator = options.getEdgeId || getEdgeId;
	let edge;
	if (isEdgeBase(edgeParams)) edge = { ...edgeParams };
	else edge = {
		...edgeParams,
		id: edgeIdGenerator(edgeParams)
	};
	if (connectionExists(edge, edges)) return edges;
	if (edge.sourceHandle === null) delete edge.sourceHandle;
	if (edge.targetHandle === null) delete edge.targetHandle;
	return edges.concat(edge);
};
/**
* Calculates the straight line path between two points.
* @public
* @returns A path string you can use in an SVG, the `labelX` and `labelY` position (center of path)
* and `offsetX`, `offsetY` between source handle and label.
*
* - `path`: the path to use in an SVG `<path>` element.
* - `labelX`: the `x` position you can use to render a label for this edge.
* - `labelY`: the `y` position you can use to render a label for this edge.
* - `offsetX`: the absolute difference between the source `x` position and the `x` position of the
* middle of this path.
* - `offsetY`: the absolute difference between the source `y` position and the `y` position of the
* middle of this path.
* @example
* ```js
*  const source = { x: 0, y: 20 };
*  const target = { x: 150, y: 100 };
*
*  const [path, labelX, labelY, offsetX, offsetY] = getStraightPath({
*    sourceX: source.x,
*    sourceY: source.y,
*    sourcePosition: Position.Right,
*    targetX: target.x,
*    targetY: target.y,
*    targetPosition: Position.Left,
*  });
* ```
* @remarks This function returns a tuple (aka a fixed-size array) to make it easier to work with multiple edge paths at once.
*/
function getStraightPath({ sourceX, sourceY, targetX, targetY }) {
	const [labelX, labelY, offsetX, offsetY] = getEdgeCenter({
		sourceX,
		sourceY,
		targetX,
		targetY
	});
	return [
		`M ${sourceX},${sourceY}L ${targetX},${targetY}`,
		labelX,
		labelY,
		offsetX,
		offsetY
	];
}
var handleDirections = {
	[Position.Left]: {
		x: -1,
		y: 0
	},
	[Position.Right]: {
		x: 1,
		y: 0
	},
	[Position.Top]: {
		x: 0,
		y: -1
	},
	[Position.Bottom]: {
		x: 0,
		y: 1
	}
};
var getDirection = ({ source, sourcePosition = Position.Bottom, target }) => {
	if (sourcePosition === Position.Left || sourcePosition === Position.Right) return source.x < target.x ? {
		x: 1,
		y: 0
	} : {
		x: -1,
		y: 0
	};
	return source.y < target.y ? {
		x: 0,
		y: 1
	} : {
		x: 0,
		y: -1
	};
};
var distance = (a, b) => Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
function getPoints({ source, sourcePosition = Position.Bottom, target, targetPosition = Position.Top, center, offset, stepPosition }) {
	const sourceDir = handleDirections[sourcePosition];
	const targetDir = handleDirections[targetPosition];
	const sourceGapped = {
		x: source.x + sourceDir.x * offset,
		y: source.y + sourceDir.y * offset
	};
	const targetGapped = {
		x: target.x + targetDir.x * offset,
		y: target.y + targetDir.y * offset
	};
	const dir = getDirection({
		source: sourceGapped,
		sourcePosition,
		target: targetGapped
	});
	const dirAccessor = dir.x !== 0 ? "x" : "y";
	const currDir = dir[dirAccessor];
	let points = [];
	let centerX, centerY;
	const sourceGapOffset = {
		x: 0,
		y: 0
	};
	const targetGapOffset = {
		x: 0,
		y: 0
	};
	const [, , defaultOffsetX, defaultOffsetY] = getEdgeCenter({
		sourceX: source.x,
		sourceY: source.y,
		targetX: target.x,
		targetY: target.y
	});
	if (sourceDir[dirAccessor] * targetDir[dirAccessor] === -1) {
		if (dirAccessor === "x") {
			centerX = center.x ?? sourceGapped.x + (targetGapped.x - sourceGapped.x) * stepPosition;
			centerY = center.y ?? (sourceGapped.y + targetGapped.y) / 2;
		} else {
			centerX = center.x ?? (sourceGapped.x + targetGapped.x) / 2;
			centerY = center.y ?? sourceGapped.y + (targetGapped.y - sourceGapped.y) * stepPosition;
		}
		const verticalSplit = [{
			x: centerX,
			y: sourceGapped.y
		}, {
			x: centerX,
			y: targetGapped.y
		}];
		const horizontalSplit = [{
			x: sourceGapped.x,
			y: centerY
		}, {
			x: targetGapped.x,
			y: centerY
		}];
		if (sourceDir[dirAccessor] === currDir) points = dirAccessor === "x" ? verticalSplit : horizontalSplit;
		else points = dirAccessor === "x" ? horizontalSplit : verticalSplit;
	} else {
		const sourceTarget = [{
			x: sourceGapped.x,
			y: targetGapped.y
		}];
		const targetSource = [{
			x: targetGapped.x,
			y: sourceGapped.y
		}];
		if (dirAccessor === "x") points = sourceDir.x === currDir ? targetSource : sourceTarget;
		else points = sourceDir.y === currDir ? sourceTarget : targetSource;
		if (sourcePosition === targetPosition) {
			const diff = Math.abs(source[dirAccessor] - target[dirAccessor]);
			if (diff <= offset) {
				const gapOffset = Math.min(offset - 1, offset - diff);
				if (sourceDir[dirAccessor] === currDir) sourceGapOffset[dirAccessor] = (sourceGapped[dirAccessor] > source[dirAccessor] ? -1 : 1) * gapOffset;
				else targetGapOffset[dirAccessor] = (targetGapped[dirAccessor] > target[dirAccessor] ? -1 : 1) * gapOffset;
			}
		}
		if (sourcePosition !== targetPosition) {
			const dirAccessorOpposite = dirAccessor === "x" ? "y" : "x";
			const isSameDir = sourceDir[dirAccessor] === targetDir[dirAccessorOpposite];
			const sourceGtTargetOppo = sourceGapped[dirAccessorOpposite] > targetGapped[dirAccessorOpposite];
			const sourceLtTargetOppo = sourceGapped[dirAccessorOpposite] < targetGapped[dirAccessorOpposite];
			if (sourceDir[dirAccessor] === 1 && (!isSameDir && sourceGtTargetOppo || isSameDir && sourceLtTargetOppo) || sourceDir[dirAccessor] !== 1 && (!isSameDir && sourceLtTargetOppo || isSameDir && sourceGtTargetOppo)) points = dirAccessor === "x" ? sourceTarget : targetSource;
		}
		const sourceGapPoint = {
			x: sourceGapped.x + sourceGapOffset.x,
			y: sourceGapped.y + sourceGapOffset.y
		};
		const targetGapPoint = {
			x: targetGapped.x + targetGapOffset.x,
			y: targetGapped.y + targetGapOffset.y
		};
		if (Math.max(Math.abs(sourceGapPoint.x - points[0].x), Math.abs(targetGapPoint.x - points[0].x)) >= Math.max(Math.abs(sourceGapPoint.y - points[0].y), Math.abs(targetGapPoint.y - points[0].y))) {
			centerX = (sourceGapPoint.x + targetGapPoint.x) / 2;
			centerY = points[0].y;
		} else {
			centerX = points[0].x;
			centerY = (sourceGapPoint.y + targetGapPoint.y) / 2;
		}
	}
	const gappedSource = {
		x: sourceGapped.x + sourceGapOffset.x,
		y: sourceGapped.y + sourceGapOffset.y
	};
	const gappedTarget = {
		x: targetGapped.x + targetGapOffset.x,
		y: targetGapped.y + targetGapOffset.y
	};
	return [
		[
			source,
			...gappedSource.x !== points[0].x || gappedSource.y !== points[0].y ? [gappedSource] : [],
			...points,
			...gappedTarget.x !== points[points.length - 1].x || gappedTarget.y !== points[points.length - 1].y ? [gappedTarget] : [],
			target
		],
		centerX,
		centerY,
		defaultOffsetX,
		defaultOffsetY
	];
}
function getBend(a, b, c, size) {
	const bendSize = Math.min(distance(a, b) / 2, distance(b, c) / 2, size);
	const { x, y } = b;
	if (a.x === x && x === c.x || a.y === y && y === c.y) return `L${x} ${y}`;
	if (a.y === y) {
		const xDir = a.x < c.x ? -1 : 1;
		const yDir = a.y < c.y ? 1 : -1;
		return `L ${x + bendSize * xDir},${y}Q ${x},${y} ${x},${y + bendSize * yDir}`;
	}
	const xDir = a.x < c.x ? 1 : -1;
	return `L ${x},${y + bendSize * (a.y < c.y ? -1 : 1)}Q ${x},${y} ${x + bendSize * xDir},${y}`;
}
/**
* The `getSmoothStepPath` util returns everything you need to render a stepped path
* between two nodes. The `borderRadius` property can be used to choose how rounded
* the corners of those steps are.
* @public
* @returns A path string you can use in an SVG, the `labelX` and `labelY` position (center of path)
* and `offsetX`, `offsetY` between source handle and label.
*
* - `path`: the path to use in an SVG `<path>` element.
* - `labelX`: the `x` position you can use to render a label for this edge.
* - `labelY`: the `y` position you can use to render a label for this edge.
* - `offsetX`: the absolute difference between the source `x` position and the `x` position of the
* middle of this path.
* - `offsetY`: the absolute difference between the source `y` position and the `y` position of the
* middle of this path.
* @example
* ```js
*  const source = { x: 0, y: 20 };
*  const target = { x: 150, y: 100 };
*
*  const [path, labelX, labelY, offsetX, offsetY] = getSmoothStepPath({
*    sourceX: source.x,
*    sourceY: source.y,
*    sourcePosition: Position.Right,
*    targetX: target.x,
*    targetY: target.y,
*    targetPosition: Position.Left,
*  });
* ```
* @remarks This function returns a tuple (aka a fixed-size array) to make it easier to work with multiple edge paths at once.
*/
function getSmoothStepPath({ sourceX, sourceY, sourcePosition = Position.Bottom, targetX, targetY, targetPosition = Position.Top, borderRadius = 5, centerX, centerY, offset = 20, stepPosition = .5 }) {
	const [points, labelX, labelY, offsetX, offsetY] = getPoints({
		source: {
			x: sourceX,
			y: sourceY
		},
		sourcePosition,
		target: {
			x: targetX,
			y: targetY
		},
		targetPosition,
		center: {
			x: centerX,
			y: centerY
		},
		offset,
		stepPosition
	});
	let path = `M${points[0].x} ${points[0].y}`;
	for (let i = 1; i < points.length - 1; i++) path += getBend(points[i - 1], points[i], points[i + 1], borderRadius);
	path += `L${points[points.length - 1].x} ${points[points.length - 1].y}`;
	return [
		path,
		labelX,
		labelY,
		offsetX,
		offsetY
	];
}
function isNodeInitialized(node) {
	return node && !!(node.internals.handleBounds || node.handles?.length) && !!(node.measured.width || node.width || node.initialWidth);
}
function getEdgePosition(params) {
	const { sourceNode, targetNode } = params;
	if (!isNodeInitialized(sourceNode) || !isNodeInitialized(targetNode)) return null;
	const sourceHandleBounds = sourceNode.internals.handleBounds || toHandleBounds(sourceNode.handles);
	const targetHandleBounds = targetNode.internals.handleBounds || toHandleBounds(targetNode.handles);
	const sourceHandle = getHandle$1(sourceHandleBounds?.source ?? [], params.sourceHandle);
	const targetHandle = getHandle$1(params.connectionMode === ConnectionMode.Strict ? targetHandleBounds?.target ?? [] : (targetHandleBounds?.target ?? []).concat(targetHandleBounds?.source ?? []), params.targetHandle);
	if (!sourceHandle || !targetHandle) {
		params.onError?.("008", errorMessages["error008"](!sourceHandle ? "source" : "target", {
			id: params.id,
			sourceHandle: params.sourceHandle,
			targetHandle: params.targetHandle
		}));
		return null;
	}
	const sourcePosition = sourceHandle?.position || Position.Bottom;
	const targetPosition = targetHandle?.position || Position.Top;
	const source = getHandlePosition(sourceNode, sourceHandle, sourcePosition);
	const target = getHandlePosition(targetNode, targetHandle, targetPosition);
	return {
		sourceX: source.x,
		sourceY: source.y,
		targetX: target.x,
		targetY: target.y,
		sourcePosition,
		targetPosition
	};
}
function toHandleBounds(handles) {
	if (!handles) return null;
	const source = [];
	const target = [];
	for (const handle of handles) {
		handle.width = handle.width ?? 1;
		handle.height = handle.height ?? 1;
		if (handle.type === "source") source.push(handle);
		else if (handle.type === "target") target.push(handle);
	}
	return {
		source,
		target
	};
}
function getHandlePosition(node, handle, fallbackPosition = Position.Left, center = false) {
	const x = (handle?.x ?? 0) + node.internals.positionAbsolute.x;
	const y = (handle?.y ?? 0) + node.internals.positionAbsolute.y;
	const { width, height } = handle ?? getNodeDimensions(node);
	if (center) return {
		x: x + width / 2,
		y: y + height / 2
	};
	switch (handle?.position ?? fallbackPosition) {
		case Position.Top: return {
			x: x + width / 2,
			y
		};
		case Position.Right: return {
			x: x + width,
			y: y + height / 2
		};
		case Position.Bottom: return {
			x: x + width / 2,
			y: y + height
		};
		case Position.Left: return {
			x,
			y: y + height / 2
		};
	}
}
function getHandle$1(bounds, handleId) {
	if (!bounds) return null;
	return (!handleId ? bounds[0] : bounds.find((d) => d.id === handleId)) || null;
}
function getMarkerId(marker, id) {
	if (!marker) return "";
	if (typeof marker === "string") return marker;
	return `${id ? `${id}__` : ""}${Object.keys(marker).sort().map((key) => `${key}=${marker[key]}`).join("&")}`;
}
function createMarkerIds(edges, { id, defaultColor, defaultMarkerStart, defaultMarkerEnd }) {
	const ids = /* @__PURE__ */ new Set();
	return edges.reduce((markers, edge) => {
		[edge.markerStart || defaultMarkerStart, edge.markerEnd || defaultMarkerEnd].forEach((marker) => {
			if (marker && typeof marker === "object") {
				const markerId = getMarkerId(marker, id);
				if (!ids.has(markerId)) {
					markers.push({
						id: markerId,
						color: marker.color || defaultColor,
						...marker
					});
					ids.add(markerId);
				}
			}
		});
		return markers;
	}, []).sort((a, b) => a.id.localeCompare(b.id));
}
var SELECTED_NODE_Z = 1e3;
var ROOT_PARENT_Z_INCREMENT = 10;
var defaultOptions = {
	nodeOrigin: [0, 0],
	nodeExtent: infiniteExtent,
	elevateNodesOnSelect: true,
	zIndexMode: "basic",
	defaults: {}
};
var adoptUserNodesDefaultOptions = {
	...defaultOptions,
	checkEquality: true
};
function mergeObjects(base, incoming) {
	const result = { ...base };
	for (const key in incoming) if (incoming[key] !== void 0) result[key] = incoming[key];
	return result;
}
function updateAbsolutePositions(nodeLookup, parentLookup, options) {
	const _options = mergeObjects(defaultOptions, options);
	for (const node of nodeLookup.values()) if (node.parentId) updateChildNode(node, nodeLookup, parentLookup, _options);
	else {
		const clampedPosition = clampPosition(getNodePositionWithOrigin(node, _options.nodeOrigin), isCoordinateExtent(node.extent) ? node.extent : _options.nodeExtent, getNodeDimensions(node));
		node.internals.positionAbsolute = clampedPosition;
	}
}
function parseHandles(userNode, internalNode) {
	if (!userNode.handles) return !userNode.measured ? void 0 : internalNode?.internals.handleBounds;
	const source = [];
	const target = [];
	for (const handle of userNode.handles) {
		const handleBounds = {
			id: handle.id,
			width: handle.width ?? 1,
			height: handle.height ?? 1,
			nodeId: userNode.id,
			x: handle.x,
			y: handle.y,
			position: handle.position,
			type: handle.type
		};
		if (handle.type === "source") source.push(handleBounds);
		else if (handle.type === "target") target.push(handleBounds);
	}
	return {
		source,
		target
	};
}
function isManualZIndexMode(zIndexMode) {
	return zIndexMode === "manual";
}
function adoptUserNodes(nodes, nodeLookup, parentLookup, options = {}) {
	const _options = mergeObjects(adoptUserNodesDefaultOptions, options);
	const rootParentIndex = { i: 0 };
	const tmpLookup = new Map(nodeLookup);
	const selectedNodeZ = _options?.elevateNodesOnSelect && !isManualZIndexMode(_options.zIndexMode) ? SELECTED_NODE_Z : 0;
	let nodesInitialized = nodes.length > 0;
	let hasSelectedNodes = false;
	nodeLookup.clear();
	parentLookup.clear();
	for (const userNode of nodes) {
		let internalNode = tmpLookup.get(userNode.id);
		if (_options.checkEquality && userNode === internalNode?.internals.userNode) nodeLookup.set(userNode.id, internalNode);
		else {
			const clampedPosition = clampPosition(getNodePositionWithOrigin(userNode, _options.nodeOrigin), isCoordinateExtent(userNode.extent) ? userNode.extent : _options.nodeExtent, getNodeDimensions(userNode));
			internalNode = {
				..._options.defaults,
				...userNode,
				measured: {
					width: userNode.measured?.width,
					height: userNode.measured?.height
				},
				internals: {
					positionAbsolute: clampedPosition,
					handleBounds: parseHandles(userNode, internalNode),
					z: calculateZ(userNode, selectedNodeZ, _options.zIndexMode),
					userNode
				}
			};
			nodeLookup.set(userNode.id, internalNode);
		}
		if ((internalNode.measured === void 0 || internalNode.measured.width === void 0 || internalNode.measured.height === void 0) && !internalNode.hidden) nodesInitialized = false;
		if (userNode.parentId) updateChildNode(internalNode, nodeLookup, parentLookup, options, rootParentIndex);
		hasSelectedNodes ||= userNode.selected ?? false;
	}
	return {
		nodesInitialized,
		hasSelectedNodes
	};
}
function updateParentLookup(node, parentLookup) {
	if (!node.parentId) return;
	const childNodes = parentLookup.get(node.parentId);
	if (childNodes) childNodes.set(node.id, node);
	else parentLookup.set(node.parentId, /* @__PURE__ */ new Map([[node.id, node]]));
}
/**
* Updates positionAbsolute and zIndex of a child node and the parentLookup.
*/
function updateChildNode(node, nodeLookup, parentLookup, options, rootParentIndex) {
	const { elevateNodesOnSelect, nodeOrigin, nodeExtent, zIndexMode } = mergeObjects(defaultOptions, options);
	const parentId = node.parentId;
	const parentNode = nodeLookup.get(parentId);
	if (!parentNode) {
		console.warn(`Parent node ${parentId} not found. Please make sure that parent nodes are in front of their child nodes in the nodes array.`);
		return;
	}
	updateParentLookup(node, parentLookup);
	if (rootParentIndex && !parentNode.parentId && parentNode.internals.rootParentIndex === void 0 && zIndexMode === "auto") {
		parentNode.internals.rootParentIndex = ++rootParentIndex.i;
		parentNode.internals.z = parentNode.internals.z + rootParentIndex.i * ROOT_PARENT_Z_INCREMENT;
	}
	if (rootParentIndex && parentNode.internals.rootParentIndex !== void 0) rootParentIndex.i = parentNode.internals.rootParentIndex;
	const { x, y, z } = calculateChildXYZ(node, parentNode, nodeOrigin, nodeExtent, elevateNodesOnSelect && !isManualZIndexMode(zIndexMode) ? SELECTED_NODE_Z : 0, zIndexMode);
	const { positionAbsolute } = node.internals;
	const positionChanged = x !== positionAbsolute.x || y !== positionAbsolute.y;
	if (positionChanged || z !== node.internals.z) nodeLookup.set(node.id, {
		...node,
		internals: {
			...node.internals,
			positionAbsolute: positionChanged ? {
				x,
				y
			} : positionAbsolute,
			z
		}
	});
}
function calculateZ(node, selectedNodeZ, zIndexMode) {
	const zIndex = isNumeric(node.zIndex) ? node.zIndex : 0;
	if (isManualZIndexMode(zIndexMode)) return zIndex;
	return zIndex + (node.selected ? selectedNodeZ : 0);
}
function calculateChildXYZ(childNode, parentNode, nodeOrigin, nodeExtent, selectedNodeZ, zIndexMode) {
	const { x: parentX, y: parentY } = parentNode.internals.positionAbsolute;
	const childDimensions = getNodeDimensions(childNode);
	const positionWithOrigin = getNodePositionWithOrigin(childNode, nodeOrigin);
	const clampedPosition = isCoordinateExtent(childNode.extent) ? clampPosition(positionWithOrigin, childNode.extent, childDimensions) : positionWithOrigin;
	let absolutePosition = clampPosition({
		x: parentX + clampedPosition.x,
		y: parentY + clampedPosition.y
	}, nodeExtent, childDimensions);
	if (childNode.extent === "parent") absolutePosition = clampPositionToParent(absolutePosition, childDimensions, parentNode);
	const childZ = calculateZ(childNode, selectedNodeZ, zIndexMode);
	const parentZ = parentNode.internals.z ?? 0;
	return {
		x: absolutePosition.x,
		y: absolutePosition.y,
		z: parentZ >= childZ ? parentZ + 1 : childZ
	};
}
function handleExpandParent(children, nodeLookup, parentLookup, nodeOrigin = [0, 0]) {
	const changes = [];
	const parentExpansions = /* @__PURE__ */ new Map();
	for (const child of children) {
		const parent = nodeLookup.get(child.parentId);
		if (!parent) continue;
		const expandedRect = getBoundsOfRects(parentExpansions.get(child.parentId)?.expandedRect ?? nodeToRect(parent), child.rect);
		parentExpansions.set(child.parentId, {
			expandedRect,
			parent
		});
	}
	if (parentExpansions.size > 0) parentExpansions.forEach(({ expandedRect, parent }, parentId) => {
		const positionAbsolute = parent.internals.positionAbsolute;
		const dimensions = getNodeDimensions(parent);
		const origin = parent.origin ?? nodeOrigin;
		const xChange = expandedRect.x < positionAbsolute.x ? Math.round(Math.abs(positionAbsolute.x - expandedRect.x)) : 0;
		const yChange = expandedRect.y < positionAbsolute.y ? Math.round(Math.abs(positionAbsolute.y - expandedRect.y)) : 0;
		const newWidth = Math.max(dimensions.width, Math.round(expandedRect.width));
		const newHeight = Math.max(dimensions.height, Math.round(expandedRect.height));
		const widthChange = (newWidth - dimensions.width) * origin[0];
		const heightChange = (newHeight - dimensions.height) * origin[1];
		if (xChange > 0 || yChange > 0 || widthChange || heightChange) {
			changes.push({
				id: parentId,
				type: "position",
				position: {
					x: parent.position.x - xChange + widthChange,
					y: parent.position.y - yChange + heightChange
				}
			});
			parentLookup.get(parentId)?.forEach((childNode) => {
				if (!children.some((child) => child.id === childNode.id)) changes.push({
					id: childNode.id,
					type: "position",
					position: {
						x: childNode.position.x + xChange,
						y: childNode.position.y + yChange
					}
				});
			});
		}
		if (dimensions.width < expandedRect.width || dimensions.height < expandedRect.height || xChange || yChange) changes.push({
			id: parentId,
			type: "dimensions",
			setAttributes: true,
			dimensions: {
				width: newWidth + (xChange ? origin[0] * xChange - widthChange : 0),
				height: newHeight + (yChange ? origin[1] * yChange - heightChange : 0)
			}
		});
	});
	return changes;
}
function updateNodeInternals(updates, nodeLookup, parentLookup, domNode, nodeOrigin, nodeExtent, zIndexMode) {
	const viewportNode = domNode?.querySelector(".xyflow__viewport");
	let updatedInternals = false;
	if (!viewportNode) return {
		changes: [],
		updatedInternals
	};
	const changes = [];
	const style = window.getComputedStyle(viewportNode);
	const { m22: zoom } = new window.DOMMatrixReadOnly(style.transform);
	const parentExpandChildren = [];
	for (const update of updates.values()) {
		const node = nodeLookup.get(update.id);
		if (!node) continue;
		if (node.hidden) {
			nodeLookup.set(node.id, {
				...node,
				internals: {
					...node.internals,
					handleBounds: void 0
				}
			});
			updatedInternals = true;
			continue;
		}
		const dimensions = getDimensions(update.nodeElement);
		const dimensionChanged = node.measured.width !== dimensions.width || node.measured.height !== dimensions.height;
		if (!!(dimensions.width && dimensions.height && (dimensionChanged || !node.internals.handleBounds || update.force))) {
			const nodeBounds = update.nodeElement.getBoundingClientRect();
			const extent = isCoordinateExtent(node.extent) ? node.extent : nodeExtent;
			let { positionAbsolute } = node.internals;
			if (node.parentId && node.extent === "parent") {
				const parentNode = nodeLookup.get(node.parentId);
				if (parentNode) positionAbsolute = clampPositionToParent(positionAbsolute, dimensions, parentNode);
			} else if (extent) positionAbsolute = clampPosition(positionAbsolute, extent, dimensions);
			const newNode = {
				...node,
				measured: dimensions,
				internals: {
					...node.internals,
					positionAbsolute,
					handleBounds: {
						source: getHandleBounds("source", update.nodeElement, nodeBounds, zoom, node.id),
						target: getHandleBounds("target", update.nodeElement, nodeBounds, zoom, node.id)
					}
				}
			};
			nodeLookup.set(node.id, newNode);
			if (node.parentId) updateChildNode(newNode, nodeLookup, parentLookup, {
				nodeOrigin,
				zIndexMode
			});
			updatedInternals = true;
			if (dimensionChanged) {
				changes.push({
					id: node.id,
					type: "dimensions",
					dimensions
				});
				if (node.expandParent && node.parentId) parentExpandChildren.push({
					id: node.id,
					parentId: node.parentId,
					rect: nodeToRect(newNode, nodeOrigin)
				});
			}
		}
	}
	if (parentExpandChildren.length > 0) {
		const parentExpandChanges = handleExpandParent(parentExpandChildren, nodeLookup, parentLookup, nodeOrigin);
		changes.push(...parentExpandChanges);
	}
	return {
		changes,
		updatedInternals
	};
}
async function panBy({ delta, panZoom, transform, translateExtent, width, height }) {
	if (!panZoom || !delta.x && !delta.y) return false;
	const nextViewport = await panZoom.setViewportConstrained({
		x: transform[0] + delta.x,
		y: transform[1] + delta.y,
		zoom: transform[2]
	}, [[0, 0], [width, height]], translateExtent);
	return !!nextViewport && (nextViewport.x !== transform[0] || nextViewport.y !== transform[1] || nextViewport.k !== transform[2]);
}
/**
* this function adds the connection to the connectionLookup
* at the following keys: nodeId-type-handleId, nodeId-type and nodeId
* @param type type of the connection
* @param connection connection that should be added to the lookup
* @param connectionKey at which key the connection should be added
* @param connectionLookup reference to the connection lookup
* @param nodeId nodeId of the connection
* @param handleId handleId of the connection
*/
function addConnectionToLookup(type, connection, connectionKey, connectionLookup, nodeId, handleId) {
	let key = nodeId;
	const nodeMap = connectionLookup.get(key) || /* @__PURE__ */ new Map();
	connectionLookup.set(key, nodeMap.set(connectionKey, connection));
	key = `${nodeId}-${type}`;
	const typeMap = connectionLookup.get(key) || /* @__PURE__ */ new Map();
	connectionLookup.set(key, typeMap.set(connectionKey, connection));
	if (handleId) {
		key = `${nodeId}-${type}-${handleId}`;
		const handleMap = connectionLookup.get(key) || /* @__PURE__ */ new Map();
		connectionLookup.set(key, handleMap.set(connectionKey, connection));
	}
}
function updateConnectionLookup(connectionLookup, edgeLookup, edges) {
	connectionLookup.clear();
	edgeLookup.clear();
	for (const edge of edges) {
		const { source: sourceNode, target: targetNode, sourceHandle = null, targetHandle = null } = edge;
		const connection = {
			edgeId: edge.id,
			source: sourceNode,
			target: targetNode,
			sourceHandle,
			targetHandle
		};
		const sourceKey = `${sourceNode}-${sourceHandle}--${targetNode}-${targetHandle}`;
		addConnectionToLookup("source", connection, `${targetNode}-${targetHandle}--${sourceNode}-${sourceHandle}`, connectionLookup, sourceNode, sourceHandle);
		addConnectionToLookup("target", connection, sourceKey, connectionLookup, targetNode, targetHandle);
		edgeLookup.set(edge.id, edge);
	}
}
function isParentSelected(node, nodeLookup) {
	if (!node.parentId) return false;
	const parentNode = nodeLookup.get(node.parentId);
	if (!parentNode) return false;
	if (parentNode.selected) return true;
	return isParentSelected(parentNode, nodeLookup);
}
function hasSelector(target, selector, domNode) {
	let current = target;
	do {
		if (current?.matches?.(selector)) return true;
		if (current === domNode) return false;
		current = current?.parentElement;
	} while (current);
	return false;
}
function getDragItems(nodeLookup, nodesDraggable, mousePos, nodeId) {
	const dragItems = /* @__PURE__ */ new Map();
	for (const [id, node] of nodeLookup) if ((node.selected || node.id === nodeId) && (!node.parentId || !isParentSelected(node, nodeLookup)) && (node.draggable || nodesDraggable && typeof node.draggable === "undefined")) {
		const internalNode = nodeLookup.get(id);
		if (internalNode) dragItems.set(id, {
			id,
			position: internalNode.position || {
				x: 0,
				y: 0
			},
			distance: {
				x: mousePos.x - internalNode.internals.positionAbsolute.x,
				y: mousePos.y - internalNode.internals.positionAbsolute.y
			},
			extent: internalNode.extent,
			parentId: internalNode.parentId,
			origin: internalNode.origin,
			expandParent: internalNode.expandParent,
			internals: { positionAbsolute: internalNode.internals.positionAbsolute || {
				x: 0,
				y: 0
			} },
			measured: {
				width: internalNode.measured.width ?? 0,
				height: internalNode.measured.height ?? 0
			}
		});
	}
	return dragItems;
}
function getEventHandlerParams({ nodeId, dragItems, nodeLookup, dragging = true }) {
	const nodesFromDragItems = [];
	for (const [id, dragItem] of dragItems) {
		const node = nodeLookup.get(id)?.internals.userNode;
		if (node) nodesFromDragItems.push({
			...node,
			position: dragItem.position,
			dragging
		});
	}
	if (!nodeId) return [nodesFromDragItems[0], nodesFromDragItems];
	const node = nodeLookup.get(nodeId)?.internals.userNode;
	return [!node ? nodesFromDragItems[0] : {
		...node,
		position: dragItems.get(nodeId)?.position || node.position,
		dragging
	}, nodesFromDragItems];
}
/**
* If a selection is being dragged we want to apply the same snap offset to all nodes in the selection.
* This function calculates the snap offset based on the first node in the selection.
*/
function calculateSnapOffset({ dragItems, snapGrid, x, y }) {
	const refDragItem = dragItems.values().next().value;
	if (!refDragItem) return null;
	const refPos = {
		x: x - refDragItem.distance.x,
		y: y - refDragItem.distance.y
	};
	const refPosSnapped = snapPosition(refPos, snapGrid);
	return {
		x: refPosSnapped.x - refPos.x,
		y: refPosSnapped.y - refPos.y
	};
}
function XYDrag({ onNodeMouseDown, getStoreItems, onDragStart, onDrag, onDragStop }) {
	let lastPos = {
		x: null,
		y: null
	};
	let autoPanId = 0;
	let dragItems = /* @__PURE__ */ new Map();
	let autoPanStarted = false;
	let mousePosition = {
		x: 0,
		y: 0
	};
	let containerBounds = null;
	let dragStarted = false;
	let d3Selection = null;
	let abortDrag = false;
	let nodePositionsChanged = false;
	let dragEvent = null;
	function update({ noDragClassName, handleSelector, domNode, isSelectable, nodeId, nodeClickDistance = 0 }) {
		d3Selection = select_default$1(domNode);
		function updateNodes({ x, y }) {
			const { nodeLookup, nodeExtent, snapGrid, snapToGrid, nodeOrigin, onNodeDrag, onSelectionDrag, onError, updateNodePositions } = getStoreItems();
			lastPos = {
				x,
				y
			};
			let hasChange = false;
			const isMultiDrag = dragItems.size > 1;
			const nodesBox = isMultiDrag && nodeExtent ? rectToBox(getInternalNodesBounds(dragItems)) : null;
			const multiDragSnapOffset = isMultiDrag && snapToGrid ? calculateSnapOffset({
				dragItems,
				snapGrid,
				x,
				y
			}) : null;
			for (const [id, dragItem] of dragItems) {
				if (!nodeLookup.has(id)) continue;
				let nextPosition = {
					x: x - dragItem.distance.x,
					y: y - dragItem.distance.y
				};
				if (snapToGrid) nextPosition = multiDragSnapOffset ? {
					x: Math.round(nextPosition.x + multiDragSnapOffset.x),
					y: Math.round(nextPosition.y + multiDragSnapOffset.y)
				} : snapPosition(nextPosition, snapGrid);
				let adjustedNodeExtent = null;
				if (isMultiDrag && nodeExtent && !dragItem.extent && nodesBox) {
					const { positionAbsolute } = dragItem.internals;
					const x1 = positionAbsolute.x - nodesBox.x + nodeExtent[0][0];
					const x2 = positionAbsolute.x + dragItem.measured.width - nodesBox.x2 + nodeExtent[1][0];
					const y1 = positionAbsolute.y - nodesBox.y + nodeExtent[0][1];
					const y2 = positionAbsolute.y + dragItem.measured.height - nodesBox.y2 + nodeExtent[1][1];
					adjustedNodeExtent = [[x1, y1], [x2, y2]];
				}
				const { position, positionAbsolute } = calculateNodePosition({
					nodeId: id,
					nextPosition,
					nodeLookup,
					nodeExtent: adjustedNodeExtent ? adjustedNodeExtent : nodeExtent,
					nodeOrigin,
					onError
				});
				hasChange = hasChange || dragItem.position.x !== position.x || dragItem.position.y !== position.y;
				dragItem.position = position;
				dragItem.internals.positionAbsolute = positionAbsolute;
			}
			nodePositionsChanged = nodePositionsChanged || hasChange;
			if (!hasChange) return;
			updateNodePositions(dragItems, true);
			if (dragEvent && (onDrag || onNodeDrag || !nodeId && onSelectionDrag)) {
				const [currentNode, currentNodes] = getEventHandlerParams({
					nodeId,
					dragItems,
					nodeLookup
				});
				onDrag?.(dragEvent, dragItems, currentNode, currentNodes);
				onNodeDrag?.(dragEvent, currentNode, currentNodes);
				if (!nodeId) onSelectionDrag?.(dragEvent, currentNodes);
			}
		}
		async function autoPan() {
			if (!containerBounds) return;
			const { transform, panBy, autoPanSpeed, autoPanOnNodeDrag } = getStoreItems();
			if (!autoPanOnNodeDrag) {
				autoPanStarted = false;
				cancelAnimationFrame(autoPanId);
				return;
			}
			const [xMovement, yMovement] = calcAutoPan(mousePosition, containerBounds, autoPanSpeed);
			if (xMovement !== 0 || yMovement !== 0) {
				lastPos.x = (lastPos.x ?? 0) - xMovement / transform[2];
				lastPos.y = (lastPos.y ?? 0) - yMovement / transform[2];
				if (await panBy({
					x: xMovement,
					y: yMovement
				})) updateNodes(lastPos);
			}
			autoPanId = requestAnimationFrame(autoPan);
		}
		function startDrag(event) {
			const { nodeLookup, multiSelectionActive, nodesDraggable, transform, snapGrid, snapToGrid, selectNodesOnDrag, onNodeDragStart, onSelectionDragStart, unselectNodesAndEdges } = getStoreItems();
			dragStarted = true;
			if ((!selectNodesOnDrag || !isSelectable) && !multiSelectionActive && nodeId) {
				if (!nodeLookup.get(nodeId)?.selected) unselectNodesAndEdges();
			}
			if (isSelectable && selectNodesOnDrag && nodeId) onNodeMouseDown?.(nodeId);
			const pointerPos = getPointerPosition(event.sourceEvent, {
				transform,
				snapGrid,
				snapToGrid,
				containerBounds
			});
			lastPos = pointerPos;
			dragItems = getDragItems(nodeLookup, nodesDraggable, pointerPos, nodeId);
			if (dragItems.size > 0 && (onDragStart || onNodeDragStart || !nodeId && onSelectionDragStart)) {
				const [currentNode, currentNodes] = getEventHandlerParams({
					nodeId,
					dragItems,
					nodeLookup
				});
				onDragStart?.(event.sourceEvent, dragItems, currentNode, currentNodes);
				onNodeDragStart?.(event.sourceEvent, currentNode, currentNodes);
				if (!nodeId) onSelectionDragStart?.(event.sourceEvent, currentNodes);
			}
		}
		const d3DragInstance = drag_default().clickDistance(nodeClickDistance).on("start", (event) => {
			const { domNode, nodeDragThreshold, transform, snapGrid, snapToGrid } = getStoreItems();
			containerBounds = domNode?.getBoundingClientRect() || null;
			abortDrag = false;
			nodePositionsChanged = false;
			dragEvent = event.sourceEvent;
			if (nodeDragThreshold === 0) startDrag(event);
			lastPos = getPointerPosition(event.sourceEvent, {
				transform,
				snapGrid,
				snapToGrid,
				containerBounds
			});
			mousePosition = getEventPosition(event.sourceEvent, containerBounds);
		}).on("drag", (event) => {
			const { autoPanOnNodeDrag, transform, snapGrid, snapToGrid, nodeDragThreshold, nodeLookup } = getStoreItems();
			const pointerPos = getPointerPosition(event.sourceEvent, {
				transform,
				snapGrid,
				snapToGrid,
				containerBounds
			});
			dragEvent = event.sourceEvent;
			if (event.sourceEvent.type === "touchmove" && event.sourceEvent.touches.length > 1 || nodeId && !nodeLookup.has(nodeId)) abortDrag = true;
			if (abortDrag) return;
			if (!autoPanStarted && autoPanOnNodeDrag && dragStarted) {
				autoPanStarted = true;
				autoPan();
			}
			if (!dragStarted) {
				const currentMousePosition = getEventPosition(event.sourceEvent, containerBounds);
				const x = currentMousePosition.x - mousePosition.x;
				const y = currentMousePosition.y - mousePosition.y;
				if (Math.sqrt(x * x + y * y) > nodeDragThreshold) startDrag(event);
			}
			if ((lastPos.x !== pointerPos.xSnapped || lastPos.y !== pointerPos.ySnapped) && dragItems && dragStarted) {
				mousePosition = getEventPosition(event.sourceEvent, containerBounds);
				updateNodes(pointerPos);
			}
		}).on("end", (event) => {
			if (!dragStarted || abortDrag) {
				if (abortDrag && dragItems.size > 0) getStoreItems().updateNodePositions(dragItems, false);
				return;
			}
			autoPanStarted = false;
			dragStarted = false;
			cancelAnimationFrame(autoPanId);
			if (dragItems.size > 0) {
				const { nodeLookup, updateNodePositions, onNodeDragStop, onSelectionDragStop } = getStoreItems();
				if (nodePositionsChanged) {
					updateNodePositions(dragItems, false);
					nodePositionsChanged = false;
				}
				if (onDragStop || onNodeDragStop || !nodeId && onSelectionDragStop) {
					const [currentNode, currentNodes] = getEventHandlerParams({
						nodeId,
						dragItems,
						nodeLookup,
						dragging: false
					});
					onDragStop?.(event.sourceEvent, dragItems, currentNode, currentNodes);
					onNodeDragStop?.(event.sourceEvent, currentNode, currentNodes);
					if (!nodeId) onSelectionDragStop?.(event.sourceEvent, currentNodes);
				}
			}
		}).filter((event) => {
			const target = event.target;
			return !event.button && (!noDragClassName || !hasSelector(target, `.${noDragClassName}`, domNode)) && (!handleSelector || hasSelector(target, handleSelector, domNode));
		});
		d3Selection.call(d3DragInstance);
	}
	function destroy() {
		d3Selection?.on(".drag", null);
	}
	return {
		update,
		destroy
	};
}
function getNodesWithinDistance(position, nodeLookup, distance) {
	const nodes = [];
	const rect = {
		x: position.x - distance,
		y: position.y - distance,
		width: distance * 2,
		height: distance * 2
	};
	for (const node of nodeLookup.values()) if (getOverlappingArea(rect, nodeToRect(node)) > 0) nodes.push(node);
	return nodes;
}
var ADDITIONAL_DISTANCE = 250;
function getClosestHandle(position, connectionRadius, nodeLookup, fromHandle) {
	let closestHandles = [];
	let minDistance = Infinity;
	const closeNodes = getNodesWithinDistance(position, nodeLookup, connectionRadius + ADDITIONAL_DISTANCE);
	for (const node of closeNodes) {
		const allHandles = [...node.internals.handleBounds?.source ?? [], ...node.internals.handleBounds?.target ?? []];
		for (const handle of allHandles) {
			if (fromHandle.nodeId === handle.nodeId && fromHandle.type === handle.type && fromHandle.id === handle.id) continue;
			const { x, y } = getHandlePosition(node, handle, handle.position, true);
			const distance = Math.sqrt(Math.pow(x - position.x, 2) + Math.pow(y - position.y, 2));
			if (distance > connectionRadius) continue;
			if (distance < minDistance) {
				closestHandles = [{
					...handle,
					x,
					y
				}];
				minDistance = distance;
			} else if (distance === minDistance) closestHandles.push({
				...handle,
				x,
				y
			});
		}
	}
	if (!closestHandles.length) return null;
	if (closestHandles.length > 1) {
		const oppositeHandleType = fromHandle.type === "source" ? "target" : "source";
		return closestHandles.find((handle) => handle.type === oppositeHandleType) ?? closestHandles[0];
	}
	return closestHandles[0];
}
function getHandle(nodeId, handleType, handleId, nodeLookup, connectionMode, withAbsolutePosition = false) {
	const node = nodeLookup.get(nodeId);
	if (!node) return null;
	const handles = connectionMode === "strict" ? node.internals.handleBounds?.[handleType] : [...node.internals.handleBounds?.source ?? [], ...node.internals.handleBounds?.target ?? []];
	const handle = (handleId ? handles?.find((h) => h.id === handleId) : handles?.[0]) ?? null;
	return handle && withAbsolutePosition ? {
		...handle,
		...getHandlePosition(node, handle, handle.position, true)
	} : handle;
}
function getHandleType(edgeUpdaterType, handleDomNode) {
	if (edgeUpdaterType) return edgeUpdaterType;
	else if (handleDomNode?.classList.contains("target")) return "target";
	else if (handleDomNode?.classList.contains("source")) return "source";
	return null;
}
function isConnectionValid(isInsideConnectionRadius, isHandleValid) {
	let isValid = null;
	if (isHandleValid) isValid = true;
	else if (isInsideConnectionRadius && !isHandleValid) isValid = false;
	return isValid;
}
var alwaysValid = () => true;
function onPointerDown(event, { connectionMode, connectionRadius, handleId, nodeId, edgeUpdaterType, isTarget, domNode, nodeLookup, lib, autoPanOnConnect, flowId, panBy, cancelConnection, onConnectStart, onConnect, onConnectEnd, isValidConnection = alwaysValid, onReconnectEnd, updateConnection, getTransform, getFromHandle, autoPanSpeed, dragThreshold = 1, handleDomNode }) {
	const doc = getHostForElement(event.target);
	let autoPanId = 0;
	let closestHandle;
	const { x, y } = getEventPosition(event);
	const handleType = getHandleType(edgeUpdaterType, handleDomNode);
	const containerBounds = domNode?.getBoundingClientRect();
	let connectionStarted = false;
	if (!containerBounds || !handleType) return;
	const fromHandleInternal = getHandle(nodeId, handleType, handleId, nodeLookup, connectionMode);
	if (!fromHandleInternal) return;
	let position = getEventPosition(event, containerBounds);
	let autoPanStarted = false;
	let connection = null;
	let isValid = false;
	let resultHandleDomNode = null;
	function autoPan() {
		if (!autoPanOnConnect || !containerBounds) return;
		const [x, y] = calcAutoPan(position, containerBounds, autoPanSpeed);
		panBy({
			x,
			y
		});
		autoPanId = requestAnimationFrame(autoPan);
	}
	const fromHandle = {
		...fromHandleInternal,
		nodeId,
		type: handleType,
		position: fromHandleInternal.position
	};
	const fromInternalNode = nodeLookup.get(nodeId);
	let previousConnection = {
		inProgress: true,
		isValid: null,
		from: getHandlePosition(fromInternalNode, fromHandle, Position.Left, true),
		fromHandle,
		fromPosition: fromHandle.position,
		fromNode: fromInternalNode,
		to: position,
		toHandle: null,
		toPosition: oppositePosition[fromHandle.position],
		toNode: null,
		pointer: position
	};
	function startConnection() {
		connectionStarted = true;
		updateConnection(previousConnection);
		onConnectStart?.(event, {
			nodeId,
			handleId,
			handleType
		});
	}
	if (dragThreshold === 0) startConnection();
	function onPointerMove(event) {
		if (!connectionStarted) {
			const { x: evtX, y: evtY } = getEventPosition(event);
			const dx = evtX - x;
			const dy = evtY - y;
			if (!(dx * dx + dy * dy > dragThreshold * dragThreshold)) return;
			startConnection();
		}
		if (!getFromHandle() || !fromHandle) {
			onPointerUp(event);
			return;
		}
		const transform = getTransform();
		position = getEventPosition(event, containerBounds);
		closestHandle = getClosestHandle(pointToRendererPoint(position, transform, false, [1, 1]), connectionRadius, nodeLookup, fromHandle);
		if (!autoPanStarted) {
			autoPan();
			autoPanStarted = true;
		}
		const result = isValidHandle(event, {
			handle: closestHandle,
			connectionMode,
			fromNodeId: nodeId,
			fromHandleId: handleId,
			fromType: isTarget ? "target" : "source",
			isValidConnection,
			doc,
			lib,
			flowId,
			nodeLookup
		});
		resultHandleDomNode = result.handleDomNode;
		connection = result.connection;
		isValid = isConnectionValid(!!closestHandle, result.isValid);
		const fromInternalNode = nodeLookup.get(nodeId);
		const from = fromInternalNode ? getHandlePosition(fromInternalNode, fromHandle, Position.Left, true) : previousConnection.from;
		const newConnection = {
			...previousConnection,
			from,
			isValid,
			to: result.toHandle && isValid ? rendererPointToPoint({
				x: result.toHandle.x,
				y: result.toHandle.y
			}, transform) : position,
			toHandle: result.toHandle,
			toPosition: isValid && result.toHandle ? result.toHandle.position : oppositePosition[fromHandle.position],
			toNode: result.toHandle ? nodeLookup.get(result.toHandle.nodeId) : null,
			pointer: position
		};
		updateConnection(newConnection);
		previousConnection = newConnection;
	}
	function onPointerUp(event) {
		if ("touches" in event && event.touches.length > 0) return;
		if (connectionStarted) {
			if ((closestHandle || resultHandleDomNode) && connection && isValid) onConnect?.(connection);
			const { inProgress, ...connectionState } = previousConnection;
			const finalConnectionState = {
				...connectionState,
				toPosition: previousConnection.toHandle ? previousConnection.toPosition : null
			};
			onConnectEnd?.(event, finalConnectionState);
			if (edgeUpdaterType) onReconnectEnd?.(event, finalConnectionState);
		}
		cancelConnection();
		cancelAnimationFrame(autoPanId);
		autoPanStarted = false;
		isValid = false;
		connection = null;
		resultHandleDomNode = null;
		doc.removeEventListener("mousemove", onPointerMove);
		doc.removeEventListener("mouseup", onPointerUp);
		doc.removeEventListener("touchmove", onPointerMove);
		doc.removeEventListener("touchend", onPointerUp);
	}
	doc.addEventListener("mousemove", onPointerMove);
	doc.addEventListener("mouseup", onPointerUp);
	doc.addEventListener("touchmove", onPointerMove);
	doc.addEventListener("touchend", onPointerUp);
}
function isValidHandle(event, { handle, connectionMode, fromNodeId, fromHandleId, fromType, doc, lib, flowId, isValidConnection = alwaysValid, nodeLookup }) {
	const isTarget = fromType === "target";
	const handleDomNode = handle ? doc.querySelector(`.${lib}-flow__handle[data-id="${flowId}-${handle?.nodeId}-${handle?.id}-${handle?.type}"]`) : null;
	const { x, y } = getEventPosition(event);
	const handleBelow = doc.elementFromPoint(x, y);
	const handleToCheck = handleBelow?.classList.contains(`${lib}-flow__handle`) ? handleBelow : handleDomNode;
	const result = {
		handleDomNode: handleToCheck,
		isValid: false,
		connection: null,
		toHandle: null
	};
	if (handleToCheck) {
		const handleType = getHandleType(void 0, handleToCheck);
		const handleNodeId = handleToCheck.getAttribute("data-nodeid");
		const handleId = handleToCheck.getAttribute("data-handleid");
		const connectable = handleToCheck.classList.contains("connectable");
		const connectableEnd = handleToCheck.classList.contains("connectableend");
		if (!handleNodeId || !handleType) return result;
		const connection = {
			source: isTarget ? handleNodeId : fromNodeId,
			sourceHandle: isTarget ? handleId : fromHandleId,
			target: isTarget ? fromNodeId : handleNodeId,
			targetHandle: isTarget ? fromHandleId : handleId
		};
		result.connection = connection;
		result.isValid = connectable && connectableEnd && (connectionMode === ConnectionMode.Strict ? isTarget && handleType === "source" || !isTarget && handleType === "target" : handleNodeId !== fromNodeId || handleId !== fromHandleId) && isValidConnection(connection);
		result.toHandle = getHandle(handleNodeId, handleType, handleId, nodeLookup, connectionMode, true);
	}
	return result;
}
var XYHandle = {
	onPointerDown,
	isValid: isValidHandle
};
function XYMinimap({ domNode, panZoom, getTransform, getViewScale }) {
	const selection = select_default$1(domNode);
	function update({ translateExtent, width, height, zoomStep = 1, pannable = true, zoomable = true, inversePan = false }) {
		const zoomHandler = (event) => {
			if (event.sourceEvent.type !== "wheel" || !panZoom) return;
			const transform = getTransform();
			const factor = event.sourceEvent.ctrlKey && isMacOs() ? 10 : 1;
			const pinchDelta = -event.sourceEvent.deltaY * (event.sourceEvent.deltaMode === 1 ? .05 : event.sourceEvent.deltaMode ? 1 : .002) * zoomStep;
			const nextZoom = transform[2] * Math.pow(2, pinchDelta * factor);
			panZoom.scaleTo(nextZoom);
		};
		let panStart = [0, 0];
		const panStartHandler = (event) => {
			if (event.sourceEvent.type === "mousedown" || event.sourceEvent.type === "touchstart") panStart = [event.sourceEvent.clientX ?? event.sourceEvent.touches[0].clientX, event.sourceEvent.clientY ?? event.sourceEvent.touches[0].clientY];
		};
		const panHandler = (event) => {
			const transform = getTransform();
			if (event.sourceEvent.type !== "mousemove" && event.sourceEvent.type !== "touchmove" || !panZoom) return;
			const panCurrent = [event.sourceEvent.clientX ?? event.sourceEvent.touches[0].clientX, event.sourceEvent.clientY ?? event.sourceEvent.touches[0].clientY];
			const panDelta = [panCurrent[0] - panStart[0], panCurrent[1] - panStart[1]];
			panStart = panCurrent;
			const moveScale = getViewScale() * Math.max(transform[2], Math.log(transform[2])) * (inversePan ? -1 : 1);
			const position = {
				x: transform[0] - panDelta[0] * moveScale,
				y: transform[1] - panDelta[1] * moveScale
			};
			const extent = [[0, 0], [width, height]];
			panZoom.setViewportConstrained({
				x: position.x,
				y: position.y,
				zoom: transform[2]
			}, extent, translateExtent);
		};
		const zoomAndPanHandler = zoom_default().on("start", panStartHandler).on("zoom", pannable ? panHandler : null).on("zoom.wheel", zoomable ? zoomHandler : null);
		selection.call(zoomAndPanHandler, {});
	}
	function destroy() {
		selection.on("zoom", null);
	}
	return {
		update,
		destroy,
		pointer: pointer_default
	};
}
var transformToViewport = (transform) => ({
	x: transform.x,
	y: transform.y,
	zoom: transform.k
});
var viewportToTransform = ({ x, y, zoom }) => identity$1.translate(x, y).scale(zoom);
var isWrappedWithClass = (event, className) => event.target.closest(`.${className}`);
var isRightClickPan = (panOnDrag, usedButton) => usedButton === 2 && Array.isArray(panOnDrag) && panOnDrag.includes(2);
var defaultEase = (t) => ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;
var getD3Transition = (selection, duration = 0, ease = defaultEase, onEnd = () => {}) => {
	const hasDuration = typeof duration === "number" && duration > 0;
	if (!hasDuration) onEnd();
	return hasDuration ? selection.transition().duration(duration).ease(ease).on("end", onEnd) : selection;
};
var wheelDelta = (event) => {
	const factor = event.ctrlKey && isMacOs() ? 10 : 1;
	return -event.deltaY * (event.deltaMode === 1 ? .05 : event.deltaMode ? 1 : .002) * factor;
};
function createPanOnScrollHandler({ zoomPanValues, noWheelClassName, d3Selection, d3Zoom, panOnScrollMode, panOnScrollSpeed, zoomOnPinch, onPanZoomStart, onPanZoom, onPanZoomEnd }) {
	return (event) => {
		if (isWrappedWithClass(event, noWheelClassName)) {
			if (event.ctrlKey) event.preventDefault();
			return false;
		}
		event.preventDefault();
		event.stopImmediatePropagation();
		const currentZoom = d3Selection.property("__zoom").k || 1;
		if (event.ctrlKey && zoomOnPinch) {
			const point = pointer_default(event);
			const pinchDelta = wheelDelta(event);
			const zoom = currentZoom * Math.pow(2, pinchDelta);
			d3Zoom.scaleTo(d3Selection, zoom, point, event);
			return;
		}
		const deltaNormalize = event.deltaMode === 1 ? 20 : 1;
		let deltaX = panOnScrollMode === PanOnScrollMode.Vertical ? 0 : event.deltaX * deltaNormalize;
		let deltaY = panOnScrollMode === PanOnScrollMode.Horizontal ? 0 : event.deltaY * deltaNormalize;
		if (!isMacOs() && event.shiftKey && panOnScrollMode !== PanOnScrollMode.Vertical) {
			deltaX = event.deltaY * deltaNormalize;
			deltaY = 0;
		}
		d3Zoom.translateBy(d3Selection, -(deltaX / currentZoom) * panOnScrollSpeed, -(deltaY / currentZoom) * panOnScrollSpeed, { internal: true });
		const nextViewport = transformToViewport(d3Selection.property("__zoom"));
		clearTimeout(zoomPanValues.panScrollTimeout);
		if (!zoomPanValues.isPanScrolling) {
			zoomPanValues.isPanScrolling = true;
			onPanZoomStart?.(event, nextViewport);
		} else onPanZoom?.(event, nextViewport);
		zoomPanValues.panScrollTimeout = setTimeout(() => {
			onPanZoomEnd?.(event, nextViewport);
			zoomPanValues.isPanScrolling = false;
		}, 150);
	};
}
function createZoomOnScrollHandler({ noWheelClassName, preventScrolling, d3ZoomHandler }) {
	return function(event, d) {
		const isWheel = event.type === "wheel";
		const preventZoom = !preventScrolling && isWheel && !event.ctrlKey;
		const hasNoWheelClass = isWrappedWithClass(event, noWheelClassName);
		if (event.ctrlKey && isWheel && hasNoWheelClass) event.preventDefault();
		if (preventZoom || hasNoWheelClass) return null;
		event.preventDefault();
		d3ZoomHandler.call(this, event, d);
	};
}
function createPanZoomStartHandler({ zoomPanValues, onDraggingChange, onPanZoomStart }) {
	return (event) => {
		if (event.sourceEvent?.internal) return;
		const viewport = transformToViewport(event.transform);
		zoomPanValues.mouseButton = event.sourceEvent?.button || 0;
		zoomPanValues.isZoomingOrPanning = true;
		zoomPanValues.prevViewport = viewport;
		if (event.sourceEvent?.type === "mousedown") onDraggingChange(true);
		if (onPanZoomStart) onPanZoomStart?.(event.sourceEvent, viewport);
	};
}
function createPanZoomHandler({ zoomPanValues, panOnDrag, onPaneContextMenu, onTransformChange, onPanZoom }) {
	return (event) => {
		zoomPanValues.usedRightMouseButton = !!(onPaneContextMenu && isRightClickPan(panOnDrag, zoomPanValues.mouseButton ?? 0));
		if (!event.sourceEvent?.sync) onTransformChange([
			event.transform.x,
			event.transform.y,
			event.transform.k
		]);
		if (onPanZoom && !event.sourceEvent?.internal) onPanZoom?.(event.sourceEvent, transformToViewport(event.transform));
	};
}
function createPanZoomEndHandler({ zoomPanValues, panOnDrag, panOnScroll, onDraggingChange, onPanZoomEnd, onPaneContextMenu }) {
	return (event) => {
		if (event.sourceEvent?.internal) return;
		zoomPanValues.isZoomingOrPanning = false;
		if (onPaneContextMenu && isRightClickPan(panOnDrag, zoomPanValues.mouseButton ?? 0) && !zoomPanValues.usedRightMouseButton && event.sourceEvent) onPaneContextMenu(event.sourceEvent);
		zoomPanValues.usedRightMouseButton = false;
		onDraggingChange(false);
		if (onPanZoomEnd) {
			const viewport = transformToViewport(event.transform);
			zoomPanValues.prevViewport = viewport;
			clearTimeout(zoomPanValues.timerId);
			zoomPanValues.timerId = setTimeout(() => {
				onPanZoomEnd?.(event.sourceEvent, viewport);
			}, panOnScroll ? 150 : 0);
		}
	};
}
function createFilter({ panActivationKeyPressed, zoomActivationKeyPressed, zoomOnScroll, zoomOnPinch, panOnDrag, panOnScroll, zoomOnDoubleClick, userSelectionActive, noWheelClassName, noPanClassName, lib, connectionInProgress }) {
	return (event) => {
		const zoomScroll = zoomActivationKeyPressed || zoomOnScroll;
		const pinchZoom = zoomOnPinch && event.ctrlKey;
		const isWheelEvent = event.type === "wheel";
		if (event.button === 1 && event.type === "mousedown" && (isWrappedWithClass(event, `${lib}-flow__node`) || isWrappedWithClass(event, `${lib}-flow__edge`) || isWrappedWithClass(event, `${lib}-flow__selection`) || isWrappedWithClass(event, `${lib}-flow__nodesselection`))) return true;
		if (!panOnDrag && !zoomScroll && !panOnScroll && !zoomOnDoubleClick && !zoomOnPinch) return false;
		if (userSelectionActive) return false;
		if (connectionInProgress && !isWheelEvent) return false;
		if (isWrappedWithClass(event, noWheelClassName) && isWheelEvent) return false;
		if (isWrappedWithClass(event, noPanClassName) && (!isWheelEvent || panOnScroll && isWheelEvent && !zoomActivationKeyPressed)) return false;
		if (!zoomOnPinch && event.ctrlKey && isWheelEvent) return false;
		if (!zoomOnPinch && event.type === "touchstart" && event.touches?.length > 1) {
			event.preventDefault();
			return false;
		}
		if (!zoomScroll && !panOnScroll && !pinchZoom && isWheelEvent) return false;
		if (!panOnDrag && (event.type === "mousedown" || event.type === "touchstart")) return false;
		if (Array.isArray(panOnDrag) && !panOnDrag.includes(event.button) && event.type === "mousedown") return false;
		const buttonAllowed = Array.isArray(panOnDrag) && panOnDrag.includes(event.button) || !event.button || event.button <= 1;
		return (!event.ctrlKey || isWheelEvent || panActivationKeyPressed) && buttonAllowed;
	};
}
function XYPanZoom({ domNode, minZoom, maxZoom, translateExtent, viewport, onPanZoom, onPanZoomStart, onPanZoomEnd, onDraggingChange }) {
	const zoomPanValues = {
		isZoomingOrPanning: false,
		usedRightMouseButton: false,
		prevViewport: {},
		mouseButton: 0,
		timerId: void 0,
		panScrollTimeout: void 0,
		isPanScrolling: false
	};
	const bbox = domNode.getBoundingClientRect();
	let cachedExtent = [[0, 0], [bbox.width, bbox.height]];
	(typeof ResizeObserver !== "undefined" ? new ResizeObserver((entries) => {
		const entry = entries[0];
		if (entry) cachedExtent = [[0, 0], [entry.contentRect.width, entry.contentRect.height]];
	}) : null)?.observe(domNode);
	const d3ZoomInstance = zoom_default().extent(() => cachedExtent).scaleExtent([minZoom, maxZoom]).translateExtent(translateExtent);
	const d3Selection = select_default$1(domNode).call(d3ZoomInstance);
	setViewportConstrained({
		x: viewport.x,
		y: viewport.y,
		zoom: clamp(viewport.zoom, minZoom, maxZoom)
	}, [[0, 0], [bbox.width, bbox.height]], translateExtent);
	const d3ZoomHandler = d3Selection.on("wheel.zoom");
	const d3DblClickZoomHandler = d3Selection.on("dblclick.zoom");
	d3ZoomInstance.wheelDelta(wheelDelta);
	async function setTransform(transform, options) {
		if (d3Selection) return new Promise((resolve) => {
			d3ZoomInstance?.interpolate(options?.interpolate === "linear" ? value_default : zoom_default$1).transform(getD3Transition(d3Selection, options?.duration, options?.ease, () => resolve(true)), transform);
		});
		return false;
	}
	function update({ noWheelClassName, noPanClassName, onPaneContextMenu, userSelectionActive, panOnScroll, panOnDrag, panOnScrollMode, panOnScrollSpeed, preventScrolling, zoomOnPinch, zoomOnScroll, zoomOnDoubleClick, panActivationKeyPressed = false, zoomActivationKeyPressed, lib, onTransformChange, connectionInProgress, paneClickDistance, selectionOnDrag }) {
		if (userSelectionActive && !zoomPanValues.isZoomingOrPanning) destroy();
		const isPanOnScroll = panOnScroll && !zoomActivationKeyPressed && !userSelectionActive;
		d3ZoomInstance.clickDistance(selectionOnDrag ? Infinity : !isNumeric(paneClickDistance) || paneClickDistance < 0 ? 0 : paneClickDistance);
		const wheelHandler = isPanOnScroll ? createPanOnScrollHandler({
			zoomPanValues,
			noWheelClassName,
			d3Selection,
			d3Zoom: d3ZoomInstance,
			panOnScrollMode,
			panOnScrollSpeed,
			zoomOnPinch,
			onPanZoomStart,
			onPanZoom,
			onPanZoomEnd
		}) : createZoomOnScrollHandler({
			noWheelClassName,
			preventScrolling,
			d3ZoomHandler
		});
		d3Selection.on("wheel.zoom", wheelHandler, { passive: false });
		const startHandler = createPanZoomStartHandler({
			zoomPanValues,
			onDraggingChange,
			onPanZoomStart
		});
		d3ZoomInstance.on("start", startHandler);
		const panZoomHandler = createPanZoomHandler({
			zoomPanValues,
			panOnDrag,
			onPaneContextMenu: !!onPaneContextMenu,
			onPanZoom,
			onTransformChange
		});
		d3ZoomInstance.on("zoom", panZoomHandler);
		const panZoomEndHandler = createPanZoomEndHandler({
			zoomPanValues,
			panOnDrag,
			panOnScroll,
			onPaneContextMenu,
			onPanZoomEnd,
			onDraggingChange
		});
		d3ZoomInstance.on("end", panZoomEndHandler);
		const filter = createFilter({
			panActivationKeyPressed,
			zoomActivationKeyPressed,
			panOnDrag,
			zoomOnScroll,
			panOnScroll,
			zoomOnDoubleClick,
			zoomOnPinch,
			userSelectionActive,
			noPanClassName,
			noWheelClassName,
			lib,
			connectionInProgress
		});
		d3ZoomInstance.filter(filter);
		if (zoomOnDoubleClick) d3Selection.on("dblclick.zoom", d3DblClickZoomHandler);
		else d3Selection.on("dblclick.zoom", null);
	}
	function destroy() {
		d3ZoomInstance.on("zoom", null);
	}
	async function setViewportConstrained(viewport, extent, translateExtent) {
		const nextTransform = viewportToTransform(viewport);
		const contrainedTransform = d3ZoomInstance?.constrain()(nextTransform, extent, translateExtent);
		if (contrainedTransform) await setTransform(contrainedTransform);
		return contrainedTransform;
	}
	async function setViewport(viewport, options) {
		const nextTransform = viewportToTransform(viewport);
		await setTransform(nextTransform, options);
		return nextTransform;
	}
	function syncViewport(viewport) {
		if (d3Selection) {
			const nextTransform = viewportToTransform(viewport);
			const currentTransform = d3Selection.property("__zoom");
			if (currentTransform.k !== viewport.zoom || currentTransform.x !== viewport.x || currentTransform.y !== viewport.y) d3ZoomInstance?.transform(d3Selection, nextTransform, null, { sync: true });
		}
	}
	function getViewport() {
		const transform$1 = d3Selection ? transform(d3Selection.node()) : {
			x: 0,
			y: 0,
			k: 1
		};
		return {
			x: transform$1.x,
			y: transform$1.y,
			zoom: transform$1.k
		};
	}
	async function scaleTo(zoom, options) {
		if (d3Selection) return new Promise((resolve) => {
			d3ZoomInstance?.interpolate(options?.interpolate === "linear" ? value_default : zoom_default$1).scaleTo(getD3Transition(d3Selection, options?.duration, options?.ease, () => resolve(true)), zoom);
		});
		return false;
	}
	async function scaleBy(factor, options) {
		if (d3Selection) return new Promise((resolve) => {
			d3ZoomInstance?.interpolate(options?.interpolate === "linear" ? value_default : zoom_default$1).scaleBy(getD3Transition(d3Selection, options?.duration, options?.ease, () => resolve(true)), factor);
		});
		return false;
	}
	function setScaleExtent(scaleExtent) {
		d3ZoomInstance?.scaleExtent(scaleExtent);
	}
	function setTranslateExtent(translateExtent) {
		d3ZoomInstance?.translateExtent(translateExtent);
	}
	function setClickDistance(distance) {
		const validDistance = !isNumeric(distance) || distance < 0 ? 0 : distance;
		d3ZoomInstance?.clickDistance(validDistance);
	}
	return {
		update,
		destroy,
		setViewport,
		setViewportConstrained,
		getViewport,
		scaleTo,
		scaleBy,
		setScaleExtent,
		setTranslateExtent,
		syncViewport,
		setClickDistance
	};
}
/**
* Used to determine the variant of the resize control
*
* @public
*/
var ResizeControlVariant;
(function(ResizeControlVariant) {
	ResizeControlVariant["Line"] = "line";
	ResizeControlVariant["Handle"] = "handle";
})(ResizeControlVariant || (ResizeControlVariant = {}));
/**
* Get all connecting edges for a given set of nodes
* @param width - new width of the node
* @param prevWidth - previous width of the node
* @param height - new height of the node
* @param prevHeight - previous height of the node
* @param affectsX - whether to invert the resize direction for the x axis
* @param affectsY - whether to invert the resize direction for the y axis
* @returns array of two numbers representing the direction of the resize for each axis, 0 = no change, 1 = increase, -1 = decrease
*/
function getResizeDirection({ width, prevWidth, height, prevHeight, affectsX, affectsY }) {
	const deltaWidth = width - prevWidth;
	const deltaHeight = height - prevHeight;
	const direction = [deltaWidth > 0 ? 1 : deltaWidth < 0 ? -1 : 0, deltaHeight > 0 ? 1 : deltaHeight < 0 ? -1 : 0];
	if (deltaWidth && affectsX) direction[0] = direction[0] * -1;
	if (deltaHeight && affectsY) direction[1] = direction[1] * -1;
	return direction;
}
/**
* Parses the control position that is being dragged to dimensions that are being resized
* @param controlPosition - position of the control that is being dragged
* @returns isHorizontal, isVertical, affectsX, affectsY,
*/
function getControlDirection(controlPosition) {
	return {
		isHorizontal: controlPosition.includes("right") || controlPosition.includes("left"),
		isVertical: controlPosition.includes("bottom") || controlPosition.includes("top"),
		affectsX: controlPosition.includes("left"),
		affectsY: controlPosition.includes("top")
	};
}
function getLowerExtentClamp(lowerExtent, lowerBound) {
	return Math.max(0, lowerBound - lowerExtent);
}
function getUpperExtentClamp(upperExtent, upperBound) {
	return Math.max(0, upperExtent - upperBound);
}
function getSizeClamp(size, minSize, maxSize) {
	return Math.max(0, minSize - size, size - maxSize);
}
function xor(a, b) {
	return a ? !b : b;
}
/**
* Calculates new width & height and x & y of node after resize based on pointer position
* @description - Buckle up, this is a chunky one... If you want to determine the new dimensions of a node after a resize,
* you have to account for all possible restrictions: min/max width/height of the node, the maximum extent the node is allowed
* to move in (in this case: resize into) determined by the parent node, the minimal extent determined by child nodes
* with expandParent or extent: 'parent' set and oh yeah, these things also have to work with keepAspectRatio!
* The way this is done is by determining how much each of these restricting actually restricts the resize and then applying the
* strongest restriction. Because the resize affects x, y and width, height and width, height of a opposing side with keepAspectRatio,
* the resize amount is always kept in distX & distY amount (the distance in mouse movement)
* Instead of clamping each value, we first calculate the biggest 'clamp' (for the lack of a better name) and then apply it to all values.
* To complicate things nodeOrigin has to be taken into account as well. This is done by offsetting the nodes as if their origin is [0, 0],
* then calculating the restrictions as usual
* @param startValues - starting values of resize
* @param controlDirection - dimensions affected by the resize
* @param pointerPosition - the current pointer position corrected for snapping
* @param boundaries - minimum and maximum dimensions of the node
* @param keepAspectRatio - prevent changes of asprect ratio
* @returns x, y, width and height of the node after resize
*/
function getDimensionsAfterResize(startValues, controlDirection, pointerPosition, boundaries, keepAspectRatio, nodeOrigin, extent, childExtent) {
	let { affectsX, affectsY } = controlDirection;
	const { isHorizontal, isVertical } = controlDirection;
	const isDiagonal = isHorizontal && isVertical;
	const { xSnapped, ySnapped } = pointerPosition;
	const { minWidth, maxWidth, minHeight, maxHeight } = boundaries;
	const { x: startX, y: startY, width: startWidth, height: startHeight, aspectRatio } = startValues;
	let distX = Math.floor(isHorizontal ? xSnapped - startValues.pointerX : 0);
	let distY = Math.floor(isVertical ? ySnapped - startValues.pointerY : 0);
	const newWidth = startWidth + (affectsX ? -distX : distX);
	const newHeight = startHeight + (affectsY ? -distY : distY);
	const originOffsetX = -nodeOrigin[0] * startWidth;
	const originOffsetY = -nodeOrigin[1] * startHeight;
	let clampX = getSizeClamp(newWidth, minWidth, maxWidth);
	let clampY = getSizeClamp(newHeight, minHeight, maxHeight);
	if (extent) {
		let xExtentClamp = 0;
		let yExtentClamp = 0;
		if (affectsX && distX < 0) xExtentClamp = getLowerExtentClamp(startX + distX + originOffsetX, extent[0][0]);
		else if (!affectsX && distX > 0) xExtentClamp = getUpperExtentClamp(startX + newWidth + originOffsetX, extent[1][0]);
		if (affectsY && distY < 0) yExtentClamp = getLowerExtentClamp(startY + distY + originOffsetY, extent[0][1]);
		else if (!affectsY && distY > 0) yExtentClamp = getUpperExtentClamp(startY + newHeight + originOffsetY, extent[1][1]);
		clampX = Math.max(clampX, xExtentClamp);
		clampY = Math.max(clampY, yExtentClamp);
	}
	if (childExtent) {
		let xExtentClamp = 0;
		let yExtentClamp = 0;
		if (affectsX && distX > 0) xExtentClamp = getUpperExtentClamp(startX + distX, childExtent[0][0]);
		else if (!affectsX && distX < 0) xExtentClamp = getLowerExtentClamp(startX + newWidth, childExtent[1][0]);
		if (affectsY && distY > 0) yExtentClamp = getUpperExtentClamp(startY + distY, childExtent[0][1]);
		else if (!affectsY && distY < 0) yExtentClamp = getLowerExtentClamp(startY + newHeight, childExtent[1][1]);
		clampX = Math.max(clampX, xExtentClamp);
		clampY = Math.max(clampY, yExtentClamp);
	}
	if (keepAspectRatio) {
		if (isHorizontal) {
			const aspectHeightClamp = getSizeClamp(newWidth / aspectRatio, minHeight, maxHeight) * aspectRatio;
			clampX = Math.max(clampX, aspectHeightClamp);
			if (extent) {
				let aspectExtentClamp = 0;
				if (!affectsX && !affectsY || affectsX && !affectsY && isDiagonal) aspectExtentClamp = getUpperExtentClamp(startY + originOffsetY + newWidth / aspectRatio, extent[1][1]) * aspectRatio;
				else aspectExtentClamp = getLowerExtentClamp(startY + originOffsetY + (affectsX ? distX : -distX) / aspectRatio, extent[0][1]) * aspectRatio;
				clampX = Math.max(clampX, aspectExtentClamp);
			}
			if (childExtent) {
				let aspectExtentClamp = 0;
				if (!affectsX && !affectsY || affectsX && !affectsY && isDiagonal) aspectExtentClamp = getLowerExtentClamp(startY + newWidth / aspectRatio, childExtent[1][1]) * aspectRatio;
				else aspectExtentClamp = getUpperExtentClamp(startY + (affectsX ? distX : -distX) / aspectRatio, childExtent[0][1]) * aspectRatio;
				clampX = Math.max(clampX, aspectExtentClamp);
			}
		}
		if (isVertical) {
			const aspectWidthClamp = getSizeClamp(newHeight * aspectRatio, minWidth, maxWidth) / aspectRatio;
			clampY = Math.max(clampY, aspectWidthClamp);
			if (extent) {
				let aspectExtentClamp = 0;
				if (!affectsX && !affectsY || affectsY && !affectsX && isDiagonal) aspectExtentClamp = getUpperExtentClamp(startX + newHeight * aspectRatio + originOffsetX, extent[1][0]) / aspectRatio;
				else aspectExtentClamp = getLowerExtentClamp(startX + (affectsY ? distY : -distY) * aspectRatio + originOffsetX, extent[0][0]) / aspectRatio;
				clampY = Math.max(clampY, aspectExtentClamp);
			}
			if (childExtent) {
				let aspectExtentClamp = 0;
				if (!affectsX && !affectsY || affectsY && !affectsX && isDiagonal) aspectExtentClamp = getLowerExtentClamp(startX + newHeight * aspectRatio, childExtent[1][0]) / aspectRatio;
				else aspectExtentClamp = getUpperExtentClamp(startX + (affectsY ? distY : -distY) * aspectRatio, childExtent[0][0]) / aspectRatio;
				clampY = Math.max(clampY, aspectExtentClamp);
			}
		}
	}
	distY = distY + (distY < 0 ? clampY : -clampY);
	distX = distX + (distX < 0 ? clampX : -clampX);
	if (keepAspectRatio) {
		if (isDiagonal) {
			if (newWidth > newHeight * aspectRatio) distY = (xor(affectsX, affectsY) ? -distX : distX) / aspectRatio;
			else distX = (xor(affectsX, affectsY) ? -distY : distY) * aspectRatio;
		} else if (isHorizontal) {
			distY = distX / aspectRatio;
			affectsY = affectsX;
		} else {
			distX = distY * aspectRatio;
			affectsX = affectsY;
		}
	}
	const x = affectsX ? startX + distX : startX;
	const y = affectsY ? startY + distY : startY;
	return {
		width: startWidth + (affectsX ? -distX : distX),
		height: startHeight + (affectsY ? -distY : distY),
		x: nodeOrigin[0] * distX * (!affectsX ? 1 : -1) + x,
		y: nodeOrigin[1] * distY * (!affectsY ? 1 : -1) + y
	};
}
var initPrevValues$1 = {
	width: 0,
	height: 0,
	x: 0,
	y: 0
};
var initStartValues = {
	...initPrevValues$1,
	pointerX: 0,
	pointerY: 0,
	aspectRatio: 1
};
function nodeToChildExtent(child, parent, nodeOrigin) {
	const x = parent.position.x + child.position.x;
	const y = parent.position.y + child.position.y;
	const width = child.measured.width ?? 0;
	const height = child.measured.height ?? 0;
	const originOffsetX = nodeOrigin[0] * width;
	const originOffsetY = nodeOrigin[1] * height;
	return [[x - originOffsetX, y - originOffsetY], [x + width - originOffsetX, y + height - originOffsetY]];
}
function XYResizer({ domNode, nodeId, getStoreItems, onChange, onEnd }) {
	const selection = select_default$1(domNode);
	let params = {
		controlDirection: getControlDirection("bottom-right"),
		boundaries: {
			minWidth: 0,
			minHeight: 0,
			maxWidth: Number.MAX_VALUE,
			maxHeight: Number.MAX_VALUE
		},
		resizeDirection: void 0,
		keepAspectRatio: false
	};
	function update({ controlPosition, boundaries, keepAspectRatio, resizeDirection, onResizeStart, onResize, onResizeEnd, shouldResize }) {
		let prevValues = { ...initPrevValues$1 };
		let startValues = { ...initStartValues };
		params = {
			boundaries,
			resizeDirection,
			keepAspectRatio,
			controlDirection: getControlDirection(controlPosition)
		};
		let node = void 0;
		let containerBounds = null;
		let childNodes = [];
		let parentNode = void 0;
		let nodeExtent = void 0;
		let childExtent = void 0;
		let resizeDetected = false;
		const dragHandler = drag_default().on("start", (event) => {
			const { nodeLookup, transform, snapGrid, snapToGrid, nodeOrigin, paneDomNode } = getStoreItems();
			node = nodeLookup.get(nodeId);
			if (!node) return;
			containerBounds = paneDomNode?.getBoundingClientRect() ?? null;
			const { xSnapped, ySnapped } = getPointerPosition(event.sourceEvent, {
				transform,
				snapGrid,
				snapToGrid,
				containerBounds
			});
			prevValues = {
				width: node.measured.width ?? 0,
				height: node.measured.height ?? 0,
				x: node.position.x ?? 0,
				y: node.position.y ?? 0
			};
			startValues = {
				...prevValues,
				pointerX: xSnapped,
				pointerY: ySnapped,
				aspectRatio: prevValues.width / prevValues.height
			};
			parentNode = void 0;
			nodeExtent = isCoordinateExtent(node.extent) ? node.extent : void 0;
			if (node.parentId && (node.extent === "parent" || node.expandParent)) parentNode = nodeLookup.get(node.parentId);
			if (parentNode && node.extent === "parent") nodeExtent = [[0, 0], [parentNode.measured.width, parentNode.measured.height]];
			childNodes = [];
			childExtent = void 0;
			for (const [childId, child] of nodeLookup) if (child.parentId === nodeId) {
				childNodes.push({
					id: childId,
					position: { ...child.position },
					extent: child.extent
				});
				if (child.extent === "parent" || child.expandParent) {
					const extent = nodeToChildExtent(child, node, child.origin ?? nodeOrigin);
					if (childExtent) childExtent = [[Math.min(extent[0][0], childExtent[0][0]), Math.min(extent[0][1], childExtent[0][1])], [Math.max(extent[1][0], childExtent[1][0]), Math.max(extent[1][1], childExtent[1][1])]];
					else childExtent = extent;
				}
			}
			onResizeStart?.(event, { ...prevValues });
		}).on("drag", (event) => {
			const { transform, snapGrid, snapToGrid, nodeOrigin: storeNodeOrigin } = getStoreItems();
			const pointerPosition = getPointerPosition(event.sourceEvent, {
				transform,
				snapGrid,
				snapToGrid,
				containerBounds
			});
			const childChanges = [];
			if (!node) return;
			const { x: prevX, y: prevY, width: prevWidth, height: prevHeight } = prevValues;
			const change = {};
			const nodeOrigin = node.origin ?? storeNodeOrigin;
			const { width, height, x, y } = getDimensionsAfterResize(startValues, params.controlDirection, pointerPosition, params.boundaries, params.keepAspectRatio, nodeOrigin, nodeExtent, childExtent);
			const isWidthChange = width !== prevWidth;
			const isHeightChange = height !== prevHeight;
			const isXPosChange = x !== prevX && isWidthChange;
			const isYPosChange = y !== prevY && isHeightChange;
			if (!isXPosChange && !isYPosChange && !isWidthChange && !isHeightChange) return;
			if (isXPosChange || isYPosChange || nodeOrigin[0] === 1 || nodeOrigin[1] === 1) {
				change.x = isXPosChange ? x : prevValues.x;
				change.y = isYPosChange ? y : prevValues.y;
				prevValues.x = change.x;
				prevValues.y = change.y;
				if (childNodes.length > 0) {
					const xChange = x - prevX;
					const yChange = y - prevY;
					for (const childNode of childNodes) {
						childNode.position = {
							x: childNode.position.x - xChange + nodeOrigin[0] * (width - prevWidth),
							y: childNode.position.y - yChange + nodeOrigin[1] * (height - prevHeight)
						};
						childChanges.push(childNode);
					}
				}
			}
			if (isWidthChange || isHeightChange) {
				change.width = isWidthChange && (!params.resizeDirection || params.resizeDirection === "horizontal") ? width : prevValues.width;
				change.height = isHeightChange && (!params.resizeDirection || params.resizeDirection === "vertical") ? height : prevValues.height;
				prevValues.width = change.width;
				prevValues.height = change.height;
			}
			if (parentNode && node.expandParent) {
				const xLimit = nodeOrigin[0] * (change.width ?? 0);
				if (change.x && change.x < xLimit) {
					prevValues.x = xLimit;
					startValues.x = startValues.x - (change.x - xLimit);
				}
				const yLimit = nodeOrigin[1] * (change.height ?? 0);
				if (change.y && change.y < yLimit) {
					prevValues.y = yLimit;
					startValues.y = startValues.y - (change.y - yLimit);
				}
			}
			const direction = getResizeDirection({
				width: prevValues.width,
				prevWidth,
				height: prevValues.height,
				prevHeight,
				affectsX: params.controlDirection.affectsX,
				affectsY: params.controlDirection.affectsY
			});
			const nextValues = {
				...prevValues,
				direction
			};
			if (shouldResize?.(event, nextValues) === false) return;
			resizeDetected = true;
			onResize?.(event, nextValues);
			onChange(change, childChanges);
		}).on("end", (event) => {
			if (!resizeDetected) return;
			onResizeEnd?.(event, { ...prevValues });
			onEnd?.({ ...prevValues });
			resizeDetected = false;
		});
		selection.call(dragHandler);
	}
	function destroy() {
		selection.on(".drag", null);
	}
	return {
		update,
		destroy
	};
}
//#endregion
//#region
/**
* @license React
* use-sync-external-store-shim.production.js
*
* Copyright (c) Meta Platforms, Inc. and affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_use_sync_external_store_shim_production = /* @__PURE__ */ __commonJSMin(((exports) => {
	var React$1 = require("react");
	function is(x, y) {
		return x === y && (0 !== x || 1 / x === 1 / y) || x !== x && y !== y;
	}
	var objectIs = "function" === typeof Object.is ? Object.is : is;
	var useState = React$1.useState;
	var useEffect = React$1.useEffect;
	var useLayoutEffect = React$1.useLayoutEffect;
	var useDebugValue = React$1.useDebugValue;
	function useSyncExternalStore$2(subscribe, getSnapshot) {
		var value = getSnapshot(), _useState = useState({ inst: {
			value,
			getSnapshot
		} }), inst = _useState[0].inst, forceUpdate = _useState[1];
		useLayoutEffect(function() {
			inst.value = value;
			inst.getSnapshot = getSnapshot;
			checkIfSnapshotChanged(inst) && forceUpdate({ inst });
		}, [
			subscribe,
			value,
			getSnapshot
		]);
		useEffect(function() {
			checkIfSnapshotChanged(inst) && forceUpdate({ inst });
			return subscribe(function() {
				checkIfSnapshotChanged(inst) && forceUpdate({ inst });
			});
		}, [subscribe]);
		useDebugValue(value);
		return value;
	}
	function checkIfSnapshotChanged(inst) {
		var latestGetSnapshot = inst.getSnapshot;
		inst = inst.value;
		try {
			var nextValue = latestGetSnapshot();
			return !objectIs(inst, nextValue);
		} catch (error) {
			return !0;
		}
	}
	function useSyncExternalStore$1(subscribe, getSnapshot) {
		return getSnapshot();
	}
	var shim = "undefined" === typeof window || "undefined" === typeof window.document || "undefined" === typeof window.document.createElement ? useSyncExternalStore$1 : useSyncExternalStore$2;
	exports.useSyncExternalStore = void 0 !== React$1.useSyncExternalStore ? React$1.useSyncExternalStore : shim;
}));
//#endregion
//#region
var require_shim = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require_use_sync_external_store_shim_production();
}));
//#endregion
//#region
/**
* @license React
* use-sync-external-store-shim/with-selector.production.js
*
* Copyright (c) Meta Platforms, Inc. and affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_with_selector_production = /* @__PURE__ */ __commonJSMin(((exports) => {
	var React = require("react");
	var shim = require_shim();
	function is(x, y) {
		return x === y && (0 !== x || 1 / x === 1 / y) || x !== x && y !== y;
	}
	var objectIs = "function" === typeof Object.is ? Object.is : is;
	var useSyncExternalStore = shim.useSyncExternalStore;
	var useRef = React.useRef;
	var useEffect = React.useEffect;
	var useMemo = React.useMemo;
	var useDebugValue = React.useDebugValue;
	exports.useSyncExternalStoreWithSelector = function(subscribe, getSnapshot, getServerSnapshot, selector, isEqual) {
		var instRef = useRef(null);
		if (null === instRef.current) {
			var inst = {
				hasValue: !1,
				value: null
			};
			instRef.current = inst;
		} else inst = instRef.current;
		instRef = useMemo(function() {
			function memoizedSelector(nextSnapshot) {
				if (!hasMemo) {
					hasMemo = !0;
					memoizedSnapshot = nextSnapshot;
					nextSnapshot = selector(nextSnapshot);
					if (void 0 !== isEqual && inst.hasValue) {
						var currentSelection = inst.value;
						if (isEqual(currentSelection, nextSnapshot)) return memoizedSelection = currentSelection;
					}
					return memoizedSelection = nextSnapshot;
				}
				currentSelection = memoizedSelection;
				if (objectIs(memoizedSnapshot, nextSnapshot)) return currentSelection;
				var nextSelection = selector(nextSnapshot);
				if (void 0 !== isEqual && isEqual(currentSelection, nextSelection)) return memoizedSnapshot = nextSnapshot, currentSelection;
				memoizedSnapshot = nextSnapshot;
				return memoizedSelection = nextSelection;
			}
			var hasMemo = !1, memoizedSnapshot, memoizedSelection, maybeGetServerSnapshot = void 0 === getServerSnapshot ? null : getServerSnapshot;
			return [function() {
				return memoizedSelector(getSnapshot());
			}, null === maybeGetServerSnapshot ? void 0 : function() {
				return memoizedSelector(maybeGetServerSnapshot());
			}];
		}, [
			getSnapshot,
			getServerSnapshot,
			selector,
			isEqual
		]);
		var value = useSyncExternalStore(subscribe, instRef[0], instRef[1]);
		useEffect(function() {
			inst.hasValue = !0;
			inst.value = value;
		}, [value]);
		useDebugValue(value);
		return value;
	};
}));
//#endregion
//#region
var import_with_selector = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require_with_selector_production();
})))(), 1);
var createStoreImpl = (createState) => {
	let state;
	const listeners = /* @__PURE__ */ new Set();
	const setState = (partial, replace) => {
		const nextState = typeof partial === "function" ? partial(state) : partial;
		if (!Object.is(nextState, state)) {
			const previousState = state;
			state = (replace != null ? replace : typeof nextState !== "object" || nextState === null) ? nextState : Object.assign({}, state, nextState);
			listeners.forEach((listener) => listener(state, previousState));
		}
	};
	const getState = () => state;
	const getInitialState = () => initialState;
	const subscribe = (listener) => {
		listeners.add(listener);
		return () => listeners.delete(listener);
	};
	const destroy = () => {
		listeners.clear();
	};
	const api = {
		setState,
		getState,
		getInitialState,
		subscribe,
		destroy
	};
	const initialState = state = createState(setState, getState, api);
	return api;
};
var createStore$1 = (createState) => createState ? createStoreImpl(createState) : createStoreImpl;
//#endregion
//#region
var { useDebugValue } = react.default;
var { useSyncExternalStoreWithSelector } = import_with_selector.default;
var identity = (arg) => arg;
function useStoreWithEqualityFn(api, selector = identity, equalityFn) {
	const slice = useSyncExternalStoreWithSelector(api.subscribe, api.getState, api.getServerState || api.getInitialState, selector, equalityFn);
	useDebugValue(slice);
	return slice;
}
var createWithEqualityFnImpl = (createState, defaultEqualityFn) => {
	const api = createStore$1(createState);
	const useBoundStoreWithEqualityFn = (selector, equalityFn = defaultEqualityFn) => useStoreWithEqualityFn(api, selector, equalityFn);
	Object.assign(useBoundStoreWithEqualityFn, api);
	return useBoundStoreWithEqualityFn;
};
var createWithEqualityFn = (createState, defaultEqualityFn) => createState ? createWithEqualityFnImpl(createState, defaultEqualityFn) : createWithEqualityFnImpl;
//#endregion
//#region
function shallow$1(objA, objB) {
	if (Object.is(objA, objB)) return true;
	if (typeof objA !== "object" || objA === null || typeof objB !== "object" || objB === null) return false;
	if (objA instanceof Map && objB instanceof Map) {
		if (objA.size !== objB.size) return false;
		for (const [key, value] of objA) if (!Object.is(value, objB.get(key))) return false;
		return true;
	}
	if (objA instanceof Set && objB instanceof Set) {
		if (objA.size !== objB.size) return false;
		for (const value of objA) if (!objB.has(value)) return false;
		return true;
	}
	const keysA = Object.keys(objA);
	if (keysA.length !== Object.keys(objB).length) return false;
	for (const keyA of keysA) if (!Object.prototype.hasOwnProperty.call(objB, keyA) || !Object.is(objA[keyA], objB[keyA])) return false;
	return true;
}
//#endregion
//#region
var StoreContext = (0, react.createContext)(null);
var Provider$1 = StoreContext.Provider;
var zustandErrorMessage = errorMessages["error001"]("react");
/**
* This hook can be used to subscribe to internal state changes of the React Flow
* component. The `useStore` hook is re-exported from the [Zustand](https://github.com/pmndrs/zustand)
* state management library, so you should check out their docs for more details.
*
* @public
* @param selector - A selector function that returns a slice of the flow's internal state.
* Extracting or transforming just the state you need is a good practice to avoid unnecessary
* re-renders.
* @param equalityFn - A function to compare the previous and next value. This is incredibly useful
* for preventing unnecessary re-renders. Good sensible defaults are using `Object.is` or importing
* `zustand/shallow`, but you can be as granular as you like.
* @returns The selected state slice.
*
* @example
* ```ts
* const nodes = useStore((state) => state.nodes);
* ```
*
* @remarks This hook should only be used if there is no other way to access the internal
* state. For many of the common use cases, there are dedicated hooks available
* such as {@link useReactFlow}, {@link useViewport}, etc.
*/
function useStore(selector, equalityFn) {
	const store = (0, react.useContext)(StoreContext);
	if (store === null) throw new Error(zustandErrorMessage);
	return useStoreWithEqualityFn(store, selector, equalityFn);
}
/**
* In some cases, you might need to access the store directly. This hook returns the store object which can be used on demand to access the state or dispatch actions.
*
* @returns The store object.
* @example
* ```ts
* const store = useStoreApi();
* ```
*
* @remarks This hook should only be used if there is no other way to access the internal
* state. For many of the common use cases, there are dedicated hooks available
* such as {@link useReactFlow}, {@link useViewport}, etc.
*/
function useStoreApi() {
	const store = (0, react.useContext)(StoreContext);
	if (store === null) throw new Error(zustandErrorMessage);
	return (0, react.useMemo)(() => ({
		getState: store.getState,
		setState: store.setState,
		subscribe: store.subscribe
	}), [store]);
}
var style = { display: "none" };
var ariaLiveStyle = {
	position: "absolute",
	width: 1,
	height: 1,
	margin: -1,
	border: 0,
	padding: 0,
	overflow: "hidden",
	clip: "rect(0px, 0px, 0px, 0px)",
	clipPath: "inset(100%)"
};
var ARIA_NODE_DESC_KEY = "react-flow__node-desc";
var ARIA_EDGE_DESC_KEY = "react-flow__edge-desc";
var ARIA_LIVE_MESSAGE = "react-flow__aria-live";
var ariaLiveSelector = (s) => s.ariaLiveMessage;
var ariaLabelConfigSelector = (s) => s.ariaLabelConfig;
function AriaLiveMessage({ rfId }) {
	const ariaLiveMessage = useStore(ariaLiveSelector);
	return jsx("div", {
		id: `${ARIA_LIVE_MESSAGE}-${rfId}`,
		"aria-live": "assertive",
		"aria-atomic": "true",
		style: ariaLiveStyle,
		children: ariaLiveMessage
	});
}
function A11yDescriptions({ rfId, disableKeyboardA11y }) {
	const ariaLabelConfig = useStore(ariaLabelConfigSelector);
	return jsxs(Fragment, { children: [
		jsx("div", {
			id: `${ARIA_NODE_DESC_KEY}-${rfId}`,
			style,
			children: disableKeyboardA11y ? ariaLabelConfig["node.a11yDescription.default"] : ariaLabelConfig["node.a11yDescription.keyboardDisabled"]
		}),
		jsx("div", {
			id: `${ARIA_EDGE_DESC_KEY}-${rfId}`,
			style,
			children: ariaLabelConfig["edge.a11yDescription.default"]
		}),
		!disableKeyboardA11y && jsx(AriaLiveMessage, { rfId })
	] });
}
/**
* The `<Panel />` component helps you position content above the viewport.
* It is used internally by the [`<MiniMap />`](/api-reference/components/minimap)
* and [`<Controls />`](/api-reference/components/controls) components.
*
* @public
*
* @example
* ```jsx
*import { ReactFlow, Background, Panel } from '@xyflow/react';
*
*export default function Flow() {
*  return (
*    <ReactFlow nodes={[]} fitView>
*      <Panel position="top-left">top-left</Panel>
*      <Panel position="top-center">top-center</Panel>
*      <Panel position="top-right">top-right</Panel>
*      <Panel position="bottom-left">bottom-left</Panel>
*      <Panel position="bottom-center">bottom-center</Panel>
*      <Panel position="bottom-right">bottom-right</Panel>
*    </ReactFlow>
*  );
*}
*```
*/
var Panel = (0, react.forwardRef)(({ position = "top-left", children, className, style, ...rest }, ref) => {
	return jsx("div", {
		className: cc([
			"react-flow__panel",
			className,
			...`${position}`.split("-")
		]),
		style,
		ref,
		...rest,
		children
	});
});
Panel.displayName = "Panel";
var link = `https://reactflow.dev?utm_source=attribution`;
/**
* React Flow is independent and entirely funded by its users.
* If you hide the attribution, please support our work by subscribing to React Flow Pro: https://reactflow.dev/remove-attribution
*/
function Attribution({ proOptions, position = "bottom-right" }) {
	(0, react.useEffect)(() => {}, []);
	if (proOptions?.hideAttribution) return null;
	return jsx(Panel, {
		position,
		className: "react-flow__attribution",
		"data-message": `Please only hide this attribution when you are subscribed to React Flow Pro: ${link}`,
		children: jsx("a", {
			href: link,
			target: "_blank",
			rel: "noopener noreferrer",
			"aria-label": "React Flow attribution",
			children: "React Flow"
		})
	});
}
var selector$l = (s) => {
	const selectedNodes = [];
	const selectedEdges = [];
	for (const [, node] of s.nodeLookup) if (node.selected) selectedNodes.push(node.internals.userNode);
	for (const [, edge] of s.edgeLookup) if (edge.selected) selectedEdges.push(edge);
	return {
		selectedNodes,
		selectedEdges
	};
};
var selectId = (obj) => obj.id;
function areEqual$1(a, b) {
	return shallow$1(a.selectedNodes.map(selectId), b.selectedNodes.map(selectId)) && shallow$1(a.selectedEdges.map(selectId), b.selectedEdges.map(selectId));
}
function SelectionListenerInner({ onSelectionChange }) {
	const store = useStoreApi();
	const { selectedNodes, selectedEdges } = useStore(selector$l, areEqual$1);
	(0, react.useEffect)(() => {
		const params = {
			nodes: selectedNodes,
			edges: selectedEdges
		};
		onSelectionChange?.(params);
		store.getState().onSelectionChangeHandlers.forEach((fn) => fn(params));
	}, [
		selectedNodes,
		selectedEdges,
		onSelectionChange
	]);
	return null;
}
var changeSelector = (s) => !!s.onSelectionChangeHandlers;
function SelectionListener({ onSelectionChange }) {
	const storeHasSelectionChangeHandlers = useStore(changeSelector);
	if (onSelectionChange || storeHasSelectionChangeHandlers) return jsx(SelectionListenerInner, { onSelectionChange });
	return null;
}
var defaultNodeOrigin = [0, 0];
var defaultViewport = {
	x: 0,
	y: 0,
	zoom: 1
};
var fieldsToTrack = [...[
	"nodes",
	"edges",
	"defaultNodes",
	"defaultEdges",
	"onConnect",
	"onConnectStart",
	"onConnectEnd",
	"onClickConnectStart",
	"onClickConnectEnd",
	"nodesDraggable",
	"autoPanOnNodeFocus",
	"nodesConnectable",
	"nodesFocusable",
	"edgesFocusable",
	"edgesReconnectable",
	"elevateNodesOnSelect",
	"elevateEdgesOnSelect",
	"minZoom",
	"maxZoom",
	"nodeExtent",
	"onNodesChange",
	"onEdgesChange",
	"elementsSelectable",
	"connectionMode",
	"snapGrid",
	"snapToGrid",
	"translateExtent",
	"connectOnClick",
	"defaultEdgeOptions",
	"fitView",
	"fitViewOptions",
	"onNodesDelete",
	"onEdgesDelete",
	"onDelete",
	"onNodeDrag",
	"onNodeDragStart",
	"onNodeDragStop",
	"onSelectionDrag",
	"onSelectionDragStart",
	"onSelectionDragStop",
	"onMoveStart",
	"onMove",
	"onMoveEnd",
	"noPanClassName",
	"nodeOrigin",
	"autoPanOnConnect",
	"autoPanOnNodeDrag",
	"onError",
	"connectionRadius",
	"isValidConnection",
	"selectNodesOnDrag",
	"nodeDragThreshold",
	"connectionDragThreshold",
	"onBeforeDelete",
	"debug",
	"autoPanSpeed",
	"ariaLabelConfig",
	"zIndexMode"
], "rfId"];
var selector$k = (s) => ({
	setNodes: s.setNodes,
	setEdges: s.setEdges,
	setMinZoom: s.setMinZoom,
	setMaxZoom: s.setMaxZoom,
	setTranslateExtent: s.setTranslateExtent,
	setNodeExtent: s.setNodeExtent,
	reset: s.reset,
	setDefaultNodesAndEdges: s.setDefaultNodesAndEdges
});
var initPrevValues = {
	translateExtent: infiniteExtent,
	nodeOrigin: defaultNodeOrigin,
	minZoom: .5,
	maxZoom: 2,
	elementsSelectable: true,
	noPanClassName: "nopan",
	rfId: "1"
};
function StoreUpdater(props) {
	const { setNodes, setEdges, setMinZoom, setMaxZoom, setTranslateExtent, setNodeExtent, reset, setDefaultNodesAndEdges } = useStore(selector$k, shallow$1);
	const store = useStoreApi();
	(0, react.useEffect)(() => {
		setDefaultNodesAndEdges(props.defaultNodes, props.defaultEdges);
		return () => {
			previousFields.current = initPrevValues;
			reset();
		};
	}, []);
	const previousFields = (0, react.useRef)(initPrevValues);
	(0, react.useEffect)(() => {
		for (const fieldName of fieldsToTrack) {
			const fieldValue = props[fieldName];
			if (fieldValue === previousFields.current[fieldName]) continue;
			if (typeof props[fieldName] === "undefined") continue;
			if (fieldName === "nodes") setNodes(fieldValue);
			else if (fieldName === "edges") setEdges(fieldValue);
			else if (fieldName === "minZoom") setMinZoom(fieldValue);
			else if (fieldName === "maxZoom") setMaxZoom(fieldValue);
			else if (fieldName === "translateExtent") setTranslateExtent(fieldValue);
			else if (fieldName === "nodeExtent") setNodeExtent(fieldValue);
			else if (fieldName === "ariaLabelConfig") store.setState({ ariaLabelConfig: mergeAriaLabelConfig(fieldValue) });
			else if (fieldName === "fitView") store.setState({ fitViewQueued: fieldValue });
			else if (fieldName === "fitViewOptions") store.setState({ fitViewOptions: fieldValue });
			else store.setState({ [fieldName]: fieldValue });
		}
		previousFields.current = props;
	}, fieldsToTrack.map((fieldName) => props[fieldName]));
	return null;
}
function getMediaQuery() {
	if (typeof window === "undefined" || !window.matchMedia) return null;
	return window.matchMedia("(prefers-color-scheme: dark)");
}
/**
* Hook for receiving the current color mode class 'dark' or 'light'.
*
* @internal
* @param colorMode - The color mode to use ('dark', 'light' or 'system')
*/
function useColorModeClass(colorMode) {
	const [colorModeClass, setColorModeClass] = (0, react.useState)(colorMode === "system" ? null : colorMode);
	(0, react.useEffect)(() => {
		if (colorMode !== "system") {
			setColorModeClass(colorMode);
			return;
		}
		const mediaQuery = getMediaQuery();
		const updateColorModeClass = () => setColorModeClass(mediaQuery?.matches ? "dark" : "light");
		updateColorModeClass();
		mediaQuery?.addEventListener("change", updateColorModeClass);
		return () => {
			mediaQuery?.removeEventListener("change", updateColorModeClass);
		};
	}, [colorMode]);
	return colorModeClass !== null ? colorModeClass : getMediaQuery()?.matches ? "dark" : "light";
}
var defaultDoc = typeof document !== "undefined" ? document : null;
/**
* This hook lets you listen for specific key codes and tells you whether they are
* currently pressed or not.
*
* @public
* @param options - Options
*
* @example
* ```tsx
*import { useKeyPress } from '@xyflow/react';
*
*export default function () {
*  const spacePressed = useKeyPress('Space');
*  const cmdAndSPressed = useKeyPress(['Meta+s', 'Strg+s']);
*
*  return (
*    <div>
*     {spacePressed && <p>Space pressed!</p>}
*     {cmdAndSPressed && <p>Cmd + S pressed!</p>}
*    </div>
*  );
*}
*```
*/
function useKeyPress(keyCode = null, options = {
	target: defaultDoc,
	actInsideInputWithModifier: true
}) {
	const [keyPressed, setKeyPressed] = (0, react.useState)(false);
	const modifierPressed = (0, react.useRef)(false);
	const pressedKeys = (0, react.useRef)(/* @__PURE__ */ new Set([]));
	const [keyCodes, keysToWatch] = (0, react.useMemo)(() => {
		if (keyCode !== null) {
			const keys = (Array.isArray(keyCode) ? keyCode : [keyCode]).filter((kc) => typeof kc === "string").map((kc) => kc.replace(/\+/g, "\n").replace("\n\n", "\n+").split("\n"));
			return [keys, keys.reduce((res, item) => res.concat(...item), [])];
		}
		return [[], []];
	}, [keyCode]);
	(0, react.useEffect)(() => {
		const target = options?.target ?? defaultDoc;
		const actInsideInputWithModifier = options?.actInsideInputWithModifier ?? true;
		if (keyCode !== null) {
			const downHandler = (event) => {
				modifierPressed.current = event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
				if ((!modifierPressed.current || modifierPressed.current && !actInsideInputWithModifier) && isInputDOMNode(event)) return false;
				const keyOrCode = useKeyOrCode(event.code, keysToWatch);
				pressedKeys.current.add(event[keyOrCode]);
				if (isMatchingKey(keyCodes, pressedKeys.current, false)) {
					const target = event.composedPath?.()?.[0] || event.target;
					const isInteractiveElement = target?.nodeName === "BUTTON" || target?.nodeName === "A";
					if (options.preventDefault !== false && (modifierPressed.current || !isInteractiveElement)) event.preventDefault();
					setKeyPressed(true);
				}
			};
			const upHandler = (event) => {
				const keyOrCode = useKeyOrCode(event.code, keysToWatch);
				if (isMatchingKey(keyCodes, pressedKeys.current, true)) {
					setKeyPressed(false);
					pressedKeys.current.clear();
				} else pressedKeys.current.delete(event[keyOrCode]);
				if (event.key === "Meta") pressedKeys.current.clear();
				modifierPressed.current = false;
			};
			const resetHandler = () => {
				pressedKeys.current.clear();
				setKeyPressed(false);
			};
			target?.addEventListener("keydown", downHandler);
			target?.addEventListener("keyup", upHandler);
			window.addEventListener("blur", resetHandler);
			window.addEventListener("contextmenu", resetHandler);
			return () => {
				target?.removeEventListener("keydown", downHandler);
				target?.removeEventListener("keyup", upHandler);
				window.removeEventListener("blur", resetHandler);
				window.removeEventListener("contextmenu", resetHandler);
			};
		}
	}, [keyCode, setKeyPressed]);
	return keyPressed;
}
function isMatchingKey(keyCodes, pressedKeys, isUp) {
	return keyCodes.filter((keys) => isUp || keys.length === pressedKeys.size).some((keys) => keys.every((k) => pressedKeys.has(k)));
}
function useKeyOrCode(eventCode, keysToWatch) {
	return keysToWatch.includes(eventCode) ? "code" : "key";
}
/**
* Hook for getting viewport helper functions.
*
* @internal
* @returns viewport helper functions
*/
var useViewportHelper = () => {
	const store = useStoreApi();
	return (0, react.useMemo)(() => {
		return {
			zoomIn: async (options) => {
				const { panZoom } = store.getState();
				return panZoom ? panZoom.scaleBy(1.2, options) : false;
			},
			zoomOut: async (options) => {
				const { panZoom } = store.getState();
				return panZoom ? panZoom.scaleBy(1 / 1.2, options) : false;
			},
			zoomTo: async (zoomLevel, options) => {
				const { panZoom } = store.getState();
				return panZoom ? panZoom.scaleTo(zoomLevel, options) : false;
			},
			getZoom: () => store.getState().transform[2],
			setViewport: async (viewport, options) => {
				const { transform: [tX, tY, tZoom], panZoom } = store.getState();
				if (!panZoom) return false;
				await panZoom.setViewport({
					x: viewport.x ?? tX,
					y: viewport.y ?? tY,
					zoom: viewport.zoom ?? tZoom
				}, options);
				return true;
			},
			getViewport: () => {
				const [x, y, zoom] = store.getState().transform;
				return {
					x,
					y,
					zoom
				};
			},
			setCenter: async (x, y, options) => {
				return store.getState().setCenter(x, y, options);
			},
			fitBounds: async (bounds, options) => {
				const { width, height, minZoom, maxZoom, panZoom } = store.getState();
				const viewport = getViewportForBounds(bounds, width, height, minZoom, maxZoom, options?.padding ?? .1);
				if (!panZoom) return false;
				await panZoom.setViewport(viewport, {
					duration: options?.duration,
					ease: options?.ease,
					interpolate: options?.interpolate
				});
				return true;
			},
			screenToFlowPosition: (clientPosition, options = {}) => {
				const { transform, snapGrid, snapToGrid, domNode } = store.getState();
				if (!domNode) return clientPosition;
				const { x: domX, y: domY } = domNode.getBoundingClientRect();
				const correctedPosition = {
					x: clientPosition.x - domX,
					y: clientPosition.y - domY
				};
				const _snapGrid = options.snapGrid ?? snapGrid;
				return pointToRendererPoint(correctedPosition, transform, options.snapToGrid ?? snapToGrid, _snapGrid);
			},
			flowToScreenPosition: (flowPosition) => {
				const { transform, domNode } = store.getState();
				if (!domNode) return flowPosition;
				const { x: domX, y: domY } = domNode.getBoundingClientRect();
				const rendererPosition = rendererPointToPoint(flowPosition, transform);
				return {
					x: rendererPosition.x + domX,
					y: rendererPosition.y + domY
				};
			}
		};
	}, []);
};
function applyChanges(changes, elements) {
	const updatedElements = [];
	const changesMap = /* @__PURE__ */ new Map();
	const addItemChanges = [];
	for (const change of changes) if (change.type === "add") {
		addItemChanges.push(change);
		continue;
	} else if (change.type === "remove" || change.type === "replace") changesMap.set(change.id, [change]);
	else {
		const elementChanges = changesMap.get(change.id);
		if (elementChanges) elementChanges.push(change);
		else changesMap.set(change.id, [change]);
	}
	for (const element of elements) {
		const changes = changesMap.get(element.id);
		if (!changes) {
			updatedElements.push(element);
			continue;
		}
		if (changes[0].type === "remove") continue;
		if (changes[0].type === "replace") {
			updatedElements.push({ ...changes[0].item });
			continue;
		}
		/**
		* For other types of changes, we want to start with a shallow copy of the
		* object so React knows this element has changed. Sequential changes will
		* each _mutate_ this object, so there's only ever one copy.
		*/
		const updatedElement = { ...element };
		for (const change of changes) applyChange(change, updatedElement);
		updatedElements.push(updatedElement);
	}
	if (addItemChanges.length) addItemChanges.forEach((change) => {
		if (change.index !== void 0) updatedElements.splice(change.index, 0, { ...change.item });
		else updatedElements.push({ ...change.item });
	});
	return updatedElements;
}
function applyChange(change, element) {
	switch (change.type) {
		case "select":
			element.selected = change.selected;
			break;
		case "position":
			if (typeof change.position !== "undefined") element.position = change.position;
			if (typeof change.dragging !== "undefined") element.dragging = change.dragging;
			break;
		case "dimensions":
			if (typeof change.dimensions !== "undefined") {
				element.measured = { ...change.dimensions };
				if (change.setAttributes) {
					if (change.setAttributes === true || change.setAttributes === "width") element.width = change.dimensions.width;
					if (change.setAttributes === true || change.setAttributes === "height") element.height = change.dimensions.height;
				}
			}
			if (typeof change.resizing === "boolean") element.resizing = change.resizing;
	}
}
/**
* Drop in function that applies node changes to an array of nodes.
* @public
* @param changes - Array of changes to apply.
* @param nodes - Array of nodes to apply the changes to.
* @returns Array of updated nodes.
* @example
*```tsx
*import { useState, useCallback } from 'react';
*import { ReactFlow, applyNodeChanges, type Node, type Edge, type OnNodesChange } from '@xyflow/react';
*
*export default function Flow() {
*  const [nodes, setNodes] = useState<Node[]>([]);
*  const [edges, setEdges] = useState<Edge[]>([]);
*  const onNodesChange: OnNodesChange = useCallback(
*    (changes) => {
*      setNodes((oldNodes) => applyNodeChanges(changes, oldNodes));
*    },
*    [setNodes],
*  );
*
*  return (
*    <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} />
*  );
*}
*```
* @remarks Various events on the <ReactFlow /> component can produce an {@link NodeChange}
* that describes how to update the edges of your flow in some way.
* If you don't need any custom behaviour, this util can be used to take an array
* of these changes and apply them to your edges.
*/
function applyNodeChanges(changes, nodes) {
	return applyChanges(changes, nodes);
}
/**
* Drop in function that applies edge changes to an array of edges.
* @public
* @param changes - Array of changes to apply.
* @param edges - Array of edge to apply the changes to.
* @returns Array of updated edges.
* @example
* ```tsx
*import { useState, useCallback } from 'react';
*import { ReactFlow, applyEdgeChanges } from '@xyflow/react';
*
*export default function Flow() {
*  const [nodes, setNodes] = useState([]);
*  const [edges, setEdges] = useState([]);
*  const onEdgesChange = useCallback(
*    (changes) => {
*      setEdges((oldEdges) => applyEdgeChanges(changes, oldEdges));
*    },
*    [setEdges],
*  );
*
*  return (
*    <ReactFlow nodes={nodes} edges={edges} onEdgesChange={onEdgesChange} />
*  );
*}
*```
* @remarks Various events on the <ReactFlow /> component can produce an {@link EdgeChange}
* that describes how to update the edges of your flow in some way.
* If you don't need any custom behaviour, this util can be used to take an array
* of these changes and apply them to your edges.
*/
function applyEdgeChanges(changes, edges) {
	return applyChanges(changes, edges);
}
function createSelectionChange(id, selected) {
	return {
		id,
		type: "select",
		selected
	};
}
function getSelectionChanges(items, selectedIds = /* @__PURE__ */ new Set(), mutateItem = false) {
	const changes = [];
	for (const [id, item] of items) {
		const willBeSelected = selectedIds.has(id);
		if (!(item.selected === void 0 && !willBeSelected) && item.selected !== willBeSelected) {
			if (mutateItem) item.selected = willBeSelected;
			changes.push(createSelectionChange(item.id, willBeSelected));
		}
	}
	return changes;
}
function getElementsDiffChanges({ items = [], lookup }) {
	const changes = [];
	const itemsLookup = new Map(items.map((item) => [item.id, item]));
	for (const [index, item] of items.entries()) {
		const lookupItem = lookup.get(item.id);
		const storeItem = lookupItem?.internals?.userNode ?? lookupItem;
		if (storeItem !== void 0 && storeItem !== item) changes.push({
			id: item.id,
			item,
			type: "replace"
		});
		if (storeItem === void 0) changes.push({
			item,
			type: "add",
			index
		});
	}
	for (const [id] of lookup) if (itemsLookup.get(id) === void 0) changes.push({
		id,
		type: "remove"
	});
	return changes;
}
function elementToRemoveChange(item) {
	return {
		id: item.id,
		type: "remove"
	};
}
var defaultOnError = createDevWarn("React Flow", "https://reactflow.dev/");
function addEdge(edgeParams, edges, options = {}) {
	return addEdge$1(edgeParams, edges, {
		...options,
		onError: options.onError ?? defaultOnError
	});
}
/**
* Test whether an object is usable as an [`Node`](/api-reference/types/node).
* In TypeScript this is a type guard that will narrow the type of whatever you pass in to
* [`Node`](/api-reference/types/node) if it returns `true`.
*
* @public
* @remarks In TypeScript this is a type guard that will narrow the type of whatever you pass in to Node if it returns true
* @param element - The element to test.
* @returns Tests whether the provided value can be used as a `Node`. If you're using TypeScript,
* this function acts as a type guard and will narrow the type of the value to `Node` if it returns
* `true`.
*
* @example
* ```js
*import { isNode } from '@xyflow/react';
*
*if (isNode(node)) {
* // ...
*}
*```
*/
var isNode = (element) => isNodeBase(element);
/**
* Test whether an object is usable as an [`Edge`](/api-reference/types/edge).
* In TypeScript this is a type guard that will narrow the type of whatever you pass in to
* [`Edge`](/api-reference/types/edge) if it returns `true`.
*
* @public
* @remarks In TypeScript this is a type guard that will narrow the type of whatever you pass in to Edge if it returns true
* @param element - The element to test
* @returns Tests whether the provided value can be used as an `Edge`. If you're using TypeScript,
* this function acts as a type guard and will narrow the type of the value to `Edge` if it returns
* `true`.
*
* @example
* ```js
*import { isEdge } from '@xyflow/react';
*
*if (isEdge(edge)) {
* // ...
*}
*```
*/
var isEdge = (element) => isEdgeBase(element);
function fixedForwardRef(render) {
	return (0, react.forwardRef)(render);
}
var useIsomorphicLayoutEffect = typeof window !== "undefined" ? react.useLayoutEffect : react.useEffect;
/**
* This hook returns a queue that can be used to batch updates.
*
* @param runQueue - a function that gets called when the queue is flushed
* @internal
*
* @returns a Queue object
*/
function useQueue(runQueue) {
	const [serial, setSerial] = (0, react.useState)(BigInt(0));
	const [queue] = (0, react.useState)(() => createQueue(() => setSerial((n) => n + BigInt(1))));
	useIsomorphicLayoutEffect(() => {
		const queueItems = queue.get();
		if (queueItems.length) {
			runQueue(queueItems);
			queue.reset();
		}
	}, [serial]);
	return queue;
}
function createQueue(cb) {
	let queue = [];
	return {
		get: () => queue,
		reset: () => {
			queue = [];
		},
		push: (item) => {
			queue.push(item);
			cb();
		}
	};
}
var BatchContext = (0, react.createContext)(null);
/**
* This is a context provider that holds and processes the node and edge update queues
* that are needed to handle setNodes, addNodes, setEdges and addEdges.
*
* @internal
*/
function BatchProvider({ children }) {
	const store = useStoreApi();
	const nodeQueue = useQueue((0, react.useCallback)((queueItems) => {
		const { nodes = [], setNodes, hasDefaultNodes, onNodesChange, nodeLookup, fitViewQueued, onNodesChangeMiddlewareMap } = store.getState();
		let next = nodes;
		for (const payload of queueItems) next = typeof payload === "function" ? payload(next) : payload;
		let changes = getElementsDiffChanges({
			items: next,
			lookup: nodeLookup
		});
		for (const middleware of onNodesChangeMiddlewareMap.values()) changes = middleware(changes);
		if (hasDefaultNodes) setNodes(next);
		if (changes.length > 0) onNodesChange?.(changes);
		else if (fitViewQueued) window.requestAnimationFrame(() => {
			const { fitViewQueued, nodes, setNodes } = store.getState();
			if (fitViewQueued) setNodes(nodes);
		});
	}, []));
	const edgeQueue = useQueue((0, react.useCallback)((queueItems) => {
		const { edges = [], setEdges, hasDefaultEdges, onEdgesChange, edgeLookup } = store.getState();
		let next = edges;
		for (const payload of queueItems) next = typeof payload === "function" ? payload(next) : payload;
		if (hasDefaultEdges) setEdges(next);
		else if (onEdgesChange) onEdgesChange(getElementsDiffChanges({
			items: next,
			lookup: edgeLookup
		}));
	}, []));
	const value = (0, react.useMemo)(() => ({
		nodeQueue,
		edgeQueue
	}), []);
	return jsx(BatchContext.Provider, {
		value,
		children
	});
}
function useBatchContext() {
	const batchContext = (0, react.useContext)(BatchContext);
	if (!batchContext) throw new Error("useBatchContext must be used within a BatchProvider");
	return batchContext;
}
var selector$j = (s) => !!s.panZoom;
/**
* This hook returns a ReactFlowInstance that can be used to update nodes and edges, manipulate the viewport, or query the current state of the flow.
*
* @public
* @example
* ```jsx
*import { useCallback, useState } from 'react';
*import { useReactFlow } from '@xyflow/react';
*
*export function NodeCounter() {
*  const reactFlow = useReactFlow();
*  const [count, setCount] = useState(0);
*  const countNodes = useCallback(() => {
*    setCount(reactFlow.getNodes().length);
*    // you need to pass it as a dependency if you are using it with useEffect or useCallback
*    // because at the first render, it's not initialized yet and some functions might not work.
*  }, [reactFlow]);
*
*  return (
*    <div>
*      <button onClick={countNodes}>Update count</button>
*      <p>There are {count} nodes in the flow.</p>
*    </div>
*  );
*}
*```
*/
function useReactFlow() {
	const viewportHelper = useViewportHelper();
	const store = useStoreApi();
	const batchContext = useBatchContext();
	const viewportInitialized = useStore(selector$j);
	const generalHelper = (0, react.useMemo)(() => {
		const getInternalNode = (id) => store.getState().nodeLookup.get(id);
		const setNodes = (payload) => {
			batchContext.nodeQueue.push(payload);
		};
		const setEdges = (payload) => {
			batchContext.edgeQueue.push(payload);
		};
		const getNodeRect = (node) => {
			const { nodeLookup, nodeOrigin } = store.getState();
			const nodeToUse = isNode(node) ? node : nodeLookup.get(node.id);
			const position = nodeToUse.parentId ? evaluateAbsolutePosition(nodeToUse.position, nodeToUse.measured, nodeToUse.parentId, nodeLookup, nodeOrigin) : nodeToUse.position;
			return nodeToRect({
				...nodeToUse,
				position,
				width: nodeToUse.measured?.width ?? nodeToUse.width,
				height: nodeToUse.measured?.height ?? nodeToUse.height
			});
		};
		const updateNode = (id, nodeUpdate, options = { replace: false }) => {
			setNodes((prevNodes) => prevNodes.map((node) => {
				if (node.id === id) {
					const nextNode = typeof nodeUpdate === "function" ? nodeUpdate(node) : nodeUpdate;
					return options.replace && isNode(nextNode) ? nextNode : {
						...node,
						...nextNode
					};
				}
				return node;
			}));
		};
		const updateEdge = (id, edgeUpdate, options = { replace: false }) => {
			setEdges((prevEdges) => prevEdges.map((edge) => {
				if (edge.id === id) {
					const nextEdge = typeof edgeUpdate === "function" ? edgeUpdate(edge) : edgeUpdate;
					return options.replace && isEdge(nextEdge) ? nextEdge : {
						...edge,
						...nextEdge
					};
				}
				return edge;
			}));
		};
		return {
			getNodes: () => store.getState().nodes.map((n) => ({ ...n })),
			getNode: (id) => getInternalNode(id)?.internals.userNode,
			getInternalNode,
			getEdges: () => {
				const { edges = [] } = store.getState();
				return edges.map((e) => ({ ...e }));
			},
			getEdge: (id) => store.getState().edgeLookup.get(id),
			setNodes,
			setEdges,
			addNodes: (payload) => {
				const newNodes = Array.isArray(payload) ? payload : [payload];
				batchContext.nodeQueue.push((nodes) => [...nodes, ...newNodes]);
			},
			addEdges: (payload) => {
				const newEdges = Array.isArray(payload) ? payload : [payload];
				batchContext.edgeQueue.push((edges) => [...edges, ...newEdges]);
			},
			toObject: () => {
				const { nodes = [], edges = [], transform } = store.getState();
				const [x, y, zoom] = transform;
				return {
					nodes: nodes.map((n) => ({ ...n })),
					edges: edges.map((e) => ({ ...e })),
					viewport: {
						x,
						y,
						zoom
					}
				};
			},
			deleteElements: async ({ nodes: nodesToRemove = [], edges: edgesToRemove = [] }) => {
				const { nodes, edges, onNodesDelete, onEdgesDelete, triggerNodeChanges, triggerEdgeChanges, onDelete, onBeforeDelete } = store.getState();
				const { nodes: matchingNodes, edges: matchingEdges } = await getElementsToRemove({
					nodesToRemove,
					edgesToRemove,
					nodes,
					edges,
					onBeforeDelete
				});
				const hasMatchingEdges = matchingEdges.length > 0;
				const hasMatchingNodes = matchingNodes.length > 0;
				if (hasMatchingEdges) {
					const edgeChanges = matchingEdges.map(elementToRemoveChange);
					onEdgesDelete?.(matchingEdges);
					triggerEdgeChanges(edgeChanges);
				}
				if (hasMatchingNodes) {
					const nodeChanges = matchingNodes.map(elementToRemoveChange);
					onNodesDelete?.(matchingNodes);
					triggerNodeChanges(nodeChanges);
				}
				if (hasMatchingNodes || hasMatchingEdges) onDelete?.({
					nodes: matchingNodes,
					edges: matchingEdges
				});
				return {
					deletedNodes: matchingNodes,
					deletedEdges: matchingEdges
				};
			},
			/**
			* Partial is defined as "the 2 nodes/areas are intersecting partially".
			* If a is contained in b or b is contained in a, they are both
			* considered fully intersecting.
			*/
			getIntersectingNodes: (nodeOrRect, partially = true, nodes) => {
				const isRect = isRectObject(nodeOrRect);
				const nodeRect = isRect ? nodeOrRect : getNodeRect(nodeOrRect);
				const hasNodesOption = nodes !== void 0;
				if (!nodeRect) return [];
				return (nodes || store.getState().nodes).filter((n) => {
					const internalNode = store.getState().nodeLookup.get(n.id);
					if (internalNode && !isRect && (n.id === nodeOrRect.id || !internalNode.internals.positionAbsolute)) return false;
					const currNodeRect = nodeToRect(hasNodesOption ? n : internalNode);
					const overlappingArea = getOverlappingArea(currNodeRect, nodeRect);
					return partially && overlappingArea > 0 || overlappingArea >= currNodeRect.width * currNodeRect.height || overlappingArea >= nodeRect.width * nodeRect.height;
				});
			},
			isNodeIntersecting: (nodeOrRect, area, partially = true) => {
				const nodeRect = isRectObject(nodeOrRect) ? nodeOrRect : getNodeRect(nodeOrRect);
				if (!nodeRect) return false;
				const overlappingArea = getOverlappingArea(nodeRect, area);
				return partially && overlappingArea > 0 || overlappingArea >= area.width * area.height || overlappingArea >= nodeRect.width * nodeRect.height;
			},
			updateNode,
			updateNodeData: (id, dataUpdate, options = { replace: false }) => {
				updateNode(id, (node) => {
					const nextData = typeof dataUpdate === "function" ? dataUpdate(node) : dataUpdate;
					return options.replace ? {
						...node,
						data: nextData
					} : {
						...node,
						data: {
							...node.data,
							...nextData
						}
					};
				}, options);
			},
			updateEdge,
			updateEdgeData: (id, dataUpdate, options = { replace: false }) => {
				updateEdge(id, (edge) => {
					const nextData = typeof dataUpdate === "function" ? dataUpdate(edge) : dataUpdate;
					return options.replace ? {
						...edge,
						data: nextData
					} : {
						...edge,
						data: {
							...edge.data,
							...nextData
						}
					};
				}, options);
			},
			getNodesBounds: (nodes) => {
				const { nodeLookup, nodeOrigin } = store.getState();
				return getNodesBounds(nodes, {
					nodeLookup,
					nodeOrigin
				});
			},
			getHandleConnections: ({ type, id, nodeId }) => Array.from(store.getState().connectionLookup.get(`${nodeId}-${type}${id ? `-${id}` : ""}`)?.values() ?? []),
			getNodeConnections: ({ type, handleId, nodeId }) => Array.from(store.getState().connectionLookup.get(`${nodeId}${type ? handleId ? `-${type}-${handleId}` : `-${type}` : ""}`)?.values() ?? []),
			fitView: async (options) => {
				const fitViewResolver = store.getState().fitViewResolver ?? withResolvers();
				store.setState({
					fitViewQueued: true,
					fitViewOptions: options,
					fitViewResolver
				});
				batchContext.nodeQueue.push((nodes) => [...nodes]);
				return fitViewResolver.promise;
			}
		};
	}, []);
	return (0, react.useMemo)(() => {
		return {
			...generalHelper,
			...viewportHelper,
			viewportInitialized
		};
	}, [viewportInitialized]);
}
var selected = (item) => item.selected;
var win$1 = typeof window !== "undefined" ? window : void 0;
/**
* Hook for handling global key events.
*
* @internal
*/
function useGlobalKeyHandler({ deleteKeyCode, multiSelectionKeyCode }) {
	const store = useStoreApi();
	const { deleteElements } = useReactFlow();
	const deleteKeyPressed = useKeyPress(deleteKeyCode, { actInsideInputWithModifier: false });
	const multiSelectionKeyPressed = useKeyPress(multiSelectionKeyCode, { target: win$1 });
	(0, react.useEffect)(() => {
		if (deleteKeyPressed) {
			const { edges, nodes } = store.getState();
			deleteElements({
				nodes: nodes.filter(selected),
				edges: edges.filter(selected)
			});
			store.setState({ nodesSelectionActive: false });
		}
	}, [deleteKeyPressed]);
	(0, react.useEffect)(() => {
		store.setState({ multiSelectionActive: multiSelectionKeyPressed });
	}, [multiSelectionKeyPressed]);
}
/**
* Hook for handling resize events.
*
* @internal
*/
function useResizeHandler(domNode) {
	const store = useStoreApi();
	(0, react.useEffect)(() => {
		const updateDimensions = () => {
			if (!domNode.current || !(domNode.current.checkVisibility?.() ?? true)) return false;
			const size = getDimensions(domNode.current);
			if (size.height === 0 || size.width === 0) store.getState().onError?.("004", errorMessages["error004"]());
			store.setState({
				width: size.width || 500,
				height: size.height || 500
			});
		};
		if (domNode.current) {
			updateDimensions();
			window.addEventListener("resize", updateDimensions);
			const resizeObserver = new ResizeObserver(() => updateDimensions());
			resizeObserver.observe(domNode.current);
			return () => {
				window.removeEventListener("resize", updateDimensions);
				if (resizeObserver && domNode.current) resizeObserver.unobserve(domNode.current);
			};
		}
	}, []);
}
var containerStyle = {
	position: "absolute",
	width: "100%",
	height: "100%",
	top: 0,
	left: 0
};
var selector$i = (s) => ({
	userSelectionActive: s.userSelectionActive,
	lib: s.lib,
	connectionInProgress: s.connection.inProgress
});
function ZoomPane({ onPaneContextMenu, zoomOnScroll = true, zoomOnPinch = true, panOnScroll = false, panActivationKeyPressed, panOnScrollSpeed = .5, panOnScrollMode = PanOnScrollMode.Free, zoomOnDoubleClick = true, panOnDrag = true, defaultViewport, translateExtent, minZoom, maxZoom, zoomActivationKeyCode, preventScrolling = true, children, noWheelClassName, noPanClassName, onViewportChange, isControlledViewport, paneClickDistance, selectionOnDrag }) {
	const store = useStoreApi();
	const zoomPane = (0, react.useRef)(null);
	const { userSelectionActive, lib, connectionInProgress } = useStore(selector$i, shallow$1);
	const zoomActivationKeyPressed = useKeyPress(zoomActivationKeyCode);
	const panZoom = (0, react.useRef)();
	useResizeHandler(zoomPane);
	const onTransformChange = (0, react.useCallback)((transform) => {
		onViewportChange?.({
			x: transform[0],
			y: transform[1],
			zoom: transform[2]
		});
		if (!isControlledViewport) store.setState({ transform });
	}, [onViewportChange, isControlledViewport]);
	(0, react.useEffect)(() => {
		if (zoomPane.current) {
			panZoom.current = XYPanZoom({
				domNode: zoomPane.current,
				minZoom,
				maxZoom,
				translateExtent,
				viewport: defaultViewport,
				onDraggingChange: (paneDragging) => store.setState((prevState) => prevState.paneDragging === paneDragging ? prevState : { paneDragging }),
				onPanZoomStart: (event, vp) => {
					const { onViewportChangeStart, onMoveStart } = store.getState();
					onMoveStart?.(event, vp);
					onViewportChangeStart?.(vp);
				},
				onPanZoom: (event, vp) => {
					const { onViewportChange, onMove } = store.getState();
					onMove?.(event, vp);
					onViewportChange?.(vp);
				},
				onPanZoomEnd: (event, vp) => {
					const { onViewportChangeEnd, onMoveEnd } = store.getState();
					onMoveEnd?.(event, vp);
					onViewportChangeEnd?.(vp);
				}
			});
			const { x, y, zoom } = panZoom.current.getViewport();
			store.setState({
				panZoom: panZoom.current,
				transform: [
					x,
					y,
					zoom
				],
				domNode: zoomPane.current.closest(".react-flow")
			});
			return () => {
				panZoom.current?.destroy();
			};
		}
	}, []);
	(0, react.useEffect)(() => {
		panZoom.current?.update({
			onPaneContextMenu,
			zoomOnScroll,
			zoomOnPinch,
			panOnScroll,
			panActivationKeyPressed,
			panOnScrollSpeed,
			panOnScrollMode,
			zoomOnDoubleClick,
			panOnDrag,
			zoomActivationKeyPressed,
			preventScrolling,
			noPanClassName,
			userSelectionActive,
			noWheelClassName,
			lib,
			onTransformChange,
			connectionInProgress,
			selectionOnDrag,
			paneClickDistance
		});
	}, [
		onPaneContextMenu,
		zoomOnScroll,
		zoomOnPinch,
		panOnScroll,
		panActivationKeyPressed,
		panOnScrollSpeed,
		panOnScrollMode,
		zoomOnDoubleClick,
		panOnDrag,
		zoomActivationKeyPressed,
		preventScrolling,
		noPanClassName,
		userSelectionActive,
		noWheelClassName,
		lib,
		onTransformChange,
		connectionInProgress,
		selectionOnDrag,
		paneClickDistance
	]);
	return jsx("div", {
		className: "react-flow__renderer",
		ref: zoomPane,
		style: containerStyle,
		children
	});
}
var selector$h = (s) => ({
	userSelectionActive: s.userSelectionActive,
	userSelectionRect: s.userSelectionRect
});
function UserSelection() {
	const { userSelectionActive, userSelectionRect } = useStore(selector$h, shallow$1);
	if (!(userSelectionActive && userSelectionRect)) return null;
	return jsx("div", {
		className: "react-flow__selection react-flow__container",
		style: {
			width: userSelectionRect.width,
			height: userSelectionRect.height,
			transform: `translate(${userSelectionRect.x}px, ${userSelectionRect.y}px)`
		}
	});
}
var wrapHandler = (handler, containerRef) => {
	return (event) => {
		if (event.target !== containerRef.current) return;
		handler?.(event);
	};
};
var selector$g = (s) => ({
	userSelectionActive: s.userSelectionActive,
	elementsSelectable: s.elementsSelectable,
	dragging: s.paneDragging,
	panBy: s.panBy,
	autoPanSpeed: s.autoPanSpeed
});
function Pane({ isSelecting, selectionKeyPressed, selectionMode = SelectionMode.Full, panOnDrag, autoPanOnSelection, paneClickDistance, selectionOnDrag, onSelectionStart, onSelectionEnd, onPaneClick, onPaneContextMenu, onPaneScroll, onPaneMouseEnter, onPaneMouseMove, onPaneMouseLeave, children }) {
	const autoPanId = (0, react.useRef)(0);
	const store = useStoreApi();
	const { userSelectionActive, elementsSelectable, dragging, panBy, autoPanSpeed } = useStore(selector$g, shallow$1);
	const isSelectionEnabled = elementsSelectable && (isSelecting || userSelectionActive);
	const container = (0, react.useRef)(null);
	const containerBounds = (0, react.useRef)();
	const selectedNodeIds = (0, react.useRef)(/* @__PURE__ */ new Set());
	const selectedEdgeIds = (0, react.useRef)(/* @__PURE__ */ new Set());
	const connectionEndedOnPane = (0, react.useRef)(false);
	const selectionInProgress = (0, react.useRef)(false);
	const position = (0, react.useRef)({
		x: 0,
		y: 0
	});
	const autoPanStarted = (0, react.useRef)(false);
	const onClick = (event) => {
		if (selectionInProgress.current || connectionEndedOnPane.current || store.getState().connection.inProgress) {
			selectionInProgress.current = false;
			connectionEndedOnPane.current = false;
			return;
		}
		onPaneClick?.(event);
		store.getState().resetSelectedElements();
		store.setState({ nodesSelectionActive: false });
	};
	const onContextMenu = (event) => {
		if (Array.isArray(panOnDrag) && panOnDrag?.includes(2)) {
			event.preventDefault();
			return;
		}
		onPaneContextMenu?.(event);
	};
	const onWheel = onPaneScroll ? (event) => onPaneScroll(event) : void 0;
	const onClickCapture = (event) => {
		if (selectionInProgress.current) {
			event.stopPropagation();
			selectionInProgress.current = false;
		}
	};
	const onPointerDownCapture = (event) => {
		if (event.pointerType === "touch" && panOnDrag !== false && !selectionKeyPressed) return;
		const { domNode, transform } = store.getState();
		containerBounds.current = domNode?.getBoundingClientRect();
		if (!containerBounds.current) return;
		const eventTargetIsContainer = event.target === container.current;
		if (!eventTargetIsContainer && !!event.target.closest(".nokey") || !isSelecting || !(selectionOnDrag && eventTargetIsContainer || selectionKeyPressed) || event.button !== 0 || !event.isPrimary) return;
		event.target?.setPointerCapture?.(event.pointerId);
		selectionInProgress.current = false;
		const { x, y } = getEventPosition(event.nativeEvent, containerBounds.current);
		const userSelectionStartPosition = pointToRendererPoint({
			x,
			y
		}, transform);
		store.setState({ userSelectionRect: {
			width: 0,
			height: 0,
			startX: userSelectionStartPosition.x,
			startY: userSelectionStartPosition.y,
			x,
			y
		} });
		if (!eventTargetIsContainer) {
			event.stopPropagation();
			event.preventDefault();
		}
	};
	function commitUserSelectionRect(mouseX, mouseY) {
		const { userSelectionRect } = store.getState();
		if (!userSelectionRect) return;
		const { transform, nodeLookup, edgeLookup, connectionLookup, triggerNodeChanges, triggerEdgeChanges, defaultEdgeOptions } = store.getState();
		const userStartPosition = {
			x: userSelectionRect.startX,
			y: userSelectionRect.startY
		};
		const { x: screenStartX, y: screenStartY } = rendererPointToPoint(userStartPosition, transform);
		const nextUserSelectRect = {
			startX: userStartPosition.x,
			startY: userStartPosition.y,
			x: mouseX < screenStartX ? mouseX : screenStartX,
			y: mouseY < screenStartY ? mouseY : screenStartY,
			width: Math.abs(mouseX - screenStartX),
			height: Math.abs(mouseY - screenStartY)
		};
		const prevSelectedNodeIds = selectedNodeIds.current;
		const prevSelectedEdgeIds = selectedEdgeIds.current;
		selectedNodeIds.current = new Set(getNodesInside(nodeLookup, nextUserSelectRect, transform, selectionMode === SelectionMode.Partial, true).map((node) => node.id));
		selectedEdgeIds.current = /* @__PURE__ */ new Set();
		const edgesSelectable = defaultEdgeOptions?.selectable ?? true;
		for (const nodeId of selectedNodeIds.current) {
			const connections = connectionLookup.get(nodeId);
			if (!connections) continue;
			for (const { edgeId } of connections.values()) {
				const edge = edgeLookup.get(edgeId);
				if (edge && (edge.selectable ?? edgesSelectable)) selectedEdgeIds.current.add(edgeId);
			}
		}
		if (!areSetsEqual(prevSelectedNodeIds, selectedNodeIds.current)) triggerNodeChanges(getSelectionChanges(nodeLookup, selectedNodeIds.current, true));
		if (!areSetsEqual(prevSelectedEdgeIds, selectedEdgeIds.current)) triggerEdgeChanges(getSelectionChanges(edgeLookup, selectedEdgeIds.current));
		store.setState({
			userSelectionRect: nextUserSelectRect,
			userSelectionActive: true,
			nodesSelectionActive: false
		});
	}
	function autoPan() {
		if (!autoPanOnSelection || !containerBounds.current) return;
		const [x, y] = calcAutoPan(position.current, containerBounds.current, autoPanSpeed);
		panBy({
			x,
			y
		}).then((panned) => {
			if (!selectionInProgress.current || !panned) {
				autoPanId.current = requestAnimationFrame(autoPan);
				return;
			}
			const { x: mx, y: my } = position.current;
			commitUserSelectionRect(mx, my);
			autoPanId.current = requestAnimationFrame(autoPan);
		});
	}
	const cleanupAutoPan = () => {
		cancelAnimationFrame(autoPanId.current);
		autoPanId.current = 0;
		autoPanStarted.current = false;
	};
	(0, react.useEffect)(() => {
		return () => cleanupAutoPan();
	}, []);
	const onPointerMove = (event) => {
		const { userSelectionRect, transform, resetSelectedElements } = store.getState();
		if (!containerBounds.current || !userSelectionRect) return;
		const { x: mouseX, y: mouseY } = getEventPosition(event.nativeEvent, containerBounds.current);
		position.current = {
			x: mouseX,
			y: mouseY
		};
		const screenStart = rendererPointToPoint({
			x: userSelectionRect.startX,
			y: userSelectionRect.startY
		}, transform);
		if (!selectionInProgress.current) {
			const requiredDistance = selectionKeyPressed ? 0 : paneClickDistance;
			if (Math.hypot(mouseX - screenStart.x, mouseY - screenStart.y) <= requiredDistance) return;
			resetSelectedElements();
			onSelectionStart?.(event);
		}
		selectionInProgress.current = true;
		if (!autoPanStarted.current) {
			autoPan();
			autoPanStarted.current = true;
		}
		commitUserSelectionRect(mouseX, mouseY);
	};
	const onPointerUp = (event) => {
		if (!isSelectionEnabled) {
			if (event.target === container.current && store.getState().connection.inProgress) connectionEndedOnPane.current = true;
			return;
		}
		if (event.button !== 0) return;
		event.target?.releasePointerCapture?.(event.pointerId);
		if (!userSelectionActive && event.target === container.current && store.getState().userSelectionRect) onClick?.(event);
		store.setState({
			userSelectionActive: false,
			userSelectionRect: null
		});
		if (selectionInProgress.current) {
			onSelectionEnd?.(event);
			store.setState({ nodesSelectionActive: selectedNodeIds.current.size > 0 });
		}
		cleanupAutoPan();
	};
	const onPointerCancel = (event) => {
		event.target?.releasePointerCapture?.(event.pointerId);
		cleanupAutoPan();
	};
	return jsxs("div", {
		className: cc(["react-flow__pane", {
			draggable: panOnDrag === true || Array.isArray(panOnDrag) && panOnDrag.includes(0),
			dragging,
			selection: isSelecting
		}]),
		onClick: isSelectionEnabled ? void 0 : wrapHandler(onClick, container),
		onContextMenu: wrapHandler(onContextMenu, container),
		onWheel: wrapHandler(onWheel, container),
		onPointerEnter: isSelectionEnabled ? void 0 : onPaneMouseEnter,
		onPointerMove: isSelectionEnabled ? onPointerMove : onPaneMouseMove,
		onPointerUp,
		onPointerCancel: isSelectionEnabled ? onPointerCancel : void 0,
		onPointerDownCapture: isSelectionEnabled ? onPointerDownCapture : void 0,
		onClickCapture: isSelectionEnabled ? onClickCapture : void 0,
		onPointerLeave: onPaneMouseLeave,
		ref: container,
		style: containerStyle,
		children: [children, jsx(UserSelection, {})]
	});
}
function handleNodeClick({ id, store, unselect = false, nodeRef }) {
	const { addSelectedNodes, unselectNodesAndEdges, multiSelectionActive, nodeLookup, onError } = store.getState();
	const node = nodeLookup.get(id);
	if (!node) {
		onError?.("012", errorMessages["error012"](id));
		return;
	}
	store.setState({ nodesSelectionActive: false });
	if (!node.selected) addSelectedNodes([id]);
	else if (unselect || node.selected && multiSelectionActive) {
		unselectNodesAndEdges({
			nodes: [node],
			edges: []
		});
		requestAnimationFrame(() => nodeRef?.current?.blur());
	}
}
/**
* Hook for calling XYDrag helper from @xyflow/system.
*
* @internal
*/
function useDrag({ nodeRef, disabled = false, noDragClassName, handleSelector, nodeId, isSelectable, nodeClickDistance }) {
	const store = useStoreApi();
	const [dragging, setDragging] = (0, react.useState)(false);
	const xyDrag = (0, react.useRef)();
	(0, react.useEffect)(() => {
		if (disabled) return;
		xyDrag.current = XYDrag({
			getStoreItems: () => store.getState(),
			onNodeMouseDown: (id) => {
				handleNodeClick({
					id,
					store,
					nodeRef
				});
			},
			onDragStart: () => {
				setDragging(true);
			},
			onDragStop: () => {
				setDragging(false);
			}
		});
		return () => {
			xyDrag.current?.destroy();
			xyDrag.current = void 0;
		};
	}, [
		disabled,
		store,
		nodeRef
	]);
	(0, react.useEffect)(() => {
		if (disabled || !nodeRef.current || !xyDrag.current) return;
		xyDrag.current.update({
			noDragClassName,
			handleSelector,
			domNode: nodeRef.current,
			isSelectable,
			nodeId,
			nodeClickDistance
		});
	}, [
		noDragClassName,
		handleSelector,
		disabled,
		isSelectable,
		nodeRef,
		nodeId,
		nodeClickDistance
	]);
	return dragging;
}
var selectedAndDraggable = (nodesDraggable) => (n) => n.selected && (n.draggable || nodesDraggable && typeof n.draggable === "undefined");
/**
* Hook for updating node positions by passing a direction and factor
*
* @internal
* @returns function for updating node positions
*/
function useMoveSelectedNodes() {
	const store = useStoreApi();
	return (0, react.useCallback)((params) => {
		const { nodeExtent, snapToGrid, snapGrid, nodesDraggable, onError, updateNodePositions, nodeLookup, nodeOrigin } = store.getState();
		const nodeUpdates = /* @__PURE__ */ new Map();
		const isSelected = selectedAndDraggable(nodesDraggable);
		const xVelo = snapToGrid ? snapGrid[0] : 5;
		const yVelo = snapToGrid ? snapGrid[1] : 5;
		const xDiff = params.direction.x * xVelo * params.factor;
		const yDiff = params.direction.y * yVelo * params.factor;
		for (const [, node] of nodeLookup) {
			if (!isSelected(node)) continue;
			let nextPosition = {
				x: node.internals.positionAbsolute.x + xDiff,
				y: node.internals.positionAbsolute.y + yDiff
			};
			if (snapToGrid) nextPosition = snapPosition(nextPosition, snapGrid);
			const { position, positionAbsolute } = calculateNodePosition({
				nodeId: node.id,
				nextPosition,
				nodeLookup,
				nodeExtent,
				nodeOrigin,
				onError
			});
			node.position = position;
			node.internals.positionAbsolute = positionAbsolute;
			nodeUpdates.set(node.id, node);
		}
		updateNodePositions(nodeUpdates);
	}, []);
}
var NodeIdContext = (0, react.createContext)(null);
var Provider = NodeIdContext.Provider;
NodeIdContext.Consumer;
/**
* You can use this hook to get the id of the node it is used inside. It is useful
* if you need the node's id deeper in the render tree but don't want to manually
* drill down the id as a prop.
*
* @public
* @returns The id for a node in the flow.
*
* @example
*```jsx
*import { useNodeId } from '@xyflow/react';
*
*export default function CustomNode() {
*  return (
*    <div>
*      <span>This node has an id of </span>
*      <NodeIdDisplay />
*    </div>
*  );
*}
*
*function NodeIdDisplay() {
*  const nodeId = useNodeId();
*
*  return <span>{nodeId}</span>;
*}
*```
*/
var useNodeId = () => {
	return (0, react.useContext)(NodeIdContext);
};
var selector$f = (s) => ({
	connectOnClick: s.connectOnClick,
	noPanClassName: s.noPanClassName,
	rfId: s.rfId
});
var HandleConfigContext = (0, react.createContext)(null);
function HandleConfigProvider({ children }) {
	const config = useStore(selector$f, shallow$1);
	return jsx(HandleConfigContext.Provider, {
		value: config,
		children
	});
}
function useHandleConfig() {
	const config = (0, react.useContext)(HandleConfigContext);
	if (!config) throw new Error("useHandleConfig must be used within a HandleConfigProvider");
	return config;
}
var idleConnectingState = {
	connectingFrom: false,
	connectingTo: false,
	clickConnecting: false,
	isPossibleEndHandle: true,
	connectionInProcess: false,
	clickConnectionInProcess: false,
	valid: false
};
var connectingSelector = (nodeId, handleId, type) => (state) => {
	const { connectionClickStartHandle: clickHandle, connectionMode, connection } = state;
	const { fromHandle, toHandle, isValid } = connection;
	if (!fromHandle && !clickHandle) return idleConnectingState;
	const connectingTo = toHandle?.nodeId === nodeId && toHandle?.id === handleId && toHandle?.type === type;
	return {
		connectingFrom: fromHandle?.nodeId === nodeId && fromHandle?.id === handleId && fromHandle?.type === type,
		connectingTo,
		clickConnecting: clickHandle?.nodeId === nodeId && clickHandle?.id === handleId && clickHandle?.type === type,
		isPossibleEndHandle: connectionMode === ConnectionMode.Strict ? fromHandle?.type !== type : nodeId !== fromHandle?.nodeId || handleId !== fromHandle?.id,
		connectionInProcess: !!fromHandle,
		clickConnectionInProcess: !!clickHandle,
		valid: connectingTo && isValid
	};
};
function HandleComponent({ type = "source", position = Position.Top, isValidConnection, isConnectable = true, isConnectableStart = true, isConnectableEnd = true, id, onConnect, children, className, onMouseDown, onTouchStart, ...rest }, ref) {
	const handleId = id || null;
	const isTarget = type === "target";
	const store = useStoreApi();
	const nodeId = useNodeId();
	const { connectOnClick, noPanClassName, rfId } = useHandleConfig();
	const { connectingFrom, connectingTo, clickConnecting, isPossibleEndHandle, connectionInProcess, clickConnectionInProcess, valid } = useStore(connectingSelector(nodeId, handleId, type), shallow$1);
	if (!nodeId) store.getState().onError?.("010", errorMessages["error010"]());
	const onConnectExtended = (params) => {
		const { defaultEdgeOptions, onConnect: onConnectAction, hasDefaultEdges } = store.getState();
		const edgeParams = {
			...defaultEdgeOptions,
			...params
		};
		if (hasDefaultEdges) {
			const { edges, setEdges, onError } = store.getState();
			setEdges(addEdge(edgeParams, edges, { onError }));
		}
		onConnectAction?.(edgeParams);
		onConnect?.(edgeParams);
	};
	const onPointerDown = (event) => {
		if (!nodeId) return;
		const isMouseTriggered = isMouseEvent(event.nativeEvent);
		if (isConnectableStart && (isMouseTriggered && event.button === 0 || !isMouseTriggered)) {
			const currentStore = store.getState();
			XYHandle.onPointerDown(event.nativeEvent, {
				handleDomNode: event.currentTarget,
				autoPanOnConnect: currentStore.autoPanOnConnect,
				connectionMode: currentStore.connectionMode,
				connectionRadius: currentStore.connectionRadius,
				domNode: currentStore.domNode,
				nodeLookup: currentStore.nodeLookup,
				lib: currentStore.lib,
				isTarget,
				handleId,
				nodeId,
				flowId: currentStore.rfId,
				panBy: currentStore.panBy,
				cancelConnection: currentStore.cancelConnection,
				onConnectStart: currentStore.onConnectStart,
				onConnectEnd: (...args) => store.getState().onConnectEnd?.(...args),
				updateConnection: currentStore.updateConnection,
				onConnect: onConnectExtended,
				isValidConnection: isValidConnection || ((...args) => store.getState().isValidConnection?.(...args) ?? true),
				getTransform: () => store.getState().transform,
				getFromHandle: () => store.getState().connection.fromHandle,
				autoPanSpeed: currentStore.autoPanSpeed,
				dragThreshold: currentStore.connectionDragThreshold
			});
		}
		if (isMouseTriggered) onMouseDown?.(event);
		else onTouchStart?.(event);
	};
	const onClick = (event) => {
		const { onClickConnectStart, onClickConnectEnd, connectionClickStartHandle, connectionMode, isValidConnection: isValidConnectionStore, lib, rfId: flowId, nodeLookup, connection: connectionState } = store.getState();
		if (!nodeId || !connectionClickStartHandle && !isConnectableStart) return;
		if (!connectionClickStartHandle) {
			onClickConnectStart?.(event.nativeEvent, {
				nodeId,
				handleId,
				handleType: type
			});
			store.setState({ connectionClickStartHandle: {
				nodeId,
				type,
				id: handleId
			} });
			return;
		}
		const doc = getHostForElement(event.target);
		const isValidConnectionHandler = isValidConnection || isValidConnectionStore;
		const { connection, isValid } = XYHandle.isValid(event.nativeEvent, {
			handle: {
				nodeId,
				id: handleId,
				type
			},
			connectionMode,
			fromNodeId: connectionClickStartHandle.nodeId,
			fromHandleId: connectionClickStartHandle.id || null,
			fromType: connectionClickStartHandle.type,
			isValidConnection: isValidConnectionHandler,
			flowId,
			doc,
			lib,
			nodeLookup
		});
		if (isValid && connection) onConnectExtended(connection);
		const connectionClone = structuredClone(connectionState);
		delete connectionClone.inProgress;
		connectionClone.toPosition = connectionClone.toHandle ? connectionClone.toHandle.position : null;
		onClickConnectEnd?.(event, connectionClone);
		store.setState({ connectionClickStartHandle: null });
	};
	return jsx("div", {
		"data-handleid": handleId,
		"data-nodeid": nodeId,
		"data-handlepos": position,
		"data-id": `${rfId}-${nodeId}-${handleId}-${type}`,
		className: cc([
			"react-flow__handle",
			`react-flow__handle-${position}`,
			"nodrag",
			noPanClassName,
			className,
			{
				source: !isTarget,
				target: isTarget,
				connectable: isConnectable,
				connectablestart: isConnectableStart,
				connectableend: isConnectableEnd,
				clickconnecting: clickConnecting,
				connectingfrom: connectingFrom,
				connectingto: connectingTo,
				valid,
				connectionindicator: isConnectable && (!connectionInProcess || isPossibleEndHandle) && (connectionInProcess || clickConnectionInProcess ? isConnectableEnd : isConnectableStart)
			}
		]),
		onMouseDown: onPointerDown,
		onTouchStart: onPointerDown,
		onClick: connectOnClick ? onClick : void 0,
		ref,
		...rest,
		children
	});
}
/**
* The `<Handle />` component is used in your [custom nodes](/learn/customization/custom-nodes)
* to define connection points.
*
*@public
*
*@example
*
*```jsx
*import { Handle, Position } from '@xyflow/react';
*
*export function CustomNode({ data }) {
*  return (
*    <>
*      <div style={{ padding: '10px 20px' }}>
*        {data.label}
*      </div>
*
*      <Handle type="target" position={Position.Left} />
*      <Handle type="source" position={Position.Right} />
*    </>
*  );
*};
*```
*/
var Handle = (0, react.memo)(fixedForwardRef(HandleComponent));
function InputNode({ data, isConnectable, sourcePosition = Position.Bottom }) {
	return jsxs(Fragment, { children: [data?.label, jsx(Handle, {
		type: "source",
		position: sourcePosition,
		isConnectable
	})] });
}
function DefaultNode({ data, isConnectable, targetPosition = Position.Top, sourcePosition = Position.Bottom }) {
	return jsxs(Fragment, { children: [
		jsx(Handle, {
			type: "target",
			position: targetPosition,
			isConnectable
		}),
		data?.label,
		jsx(Handle, {
			type: "source",
			position: sourcePosition,
			isConnectable
		})
	] });
}
function GroupNode() {
	return null;
}
function OutputNode({ data, isConnectable, targetPosition = Position.Top }) {
	return jsxs(Fragment, { children: [jsx(Handle, {
		type: "target",
		position: targetPosition,
		isConnectable
	}), data?.label] });
}
var arrowKeyDiffs = {
	ArrowUp: {
		x: 0,
		y: -1
	},
	ArrowDown: {
		x: 0,
		y: 1
	},
	ArrowLeft: {
		x: -1,
		y: 0
	},
	ArrowRight: {
		x: 1,
		y: 0
	}
};
var builtinNodeTypes = {
	input: InputNode,
	default: DefaultNode,
	output: OutputNode,
	group: GroupNode
};
function getNodeInlineStyleDimensions(node) {
	if (node.internals.handleBounds === void 0) return {
		width: node.width ?? node.initialWidth ?? node.style?.width,
		height: node.height ?? node.initialHeight ?? node.style?.height
	};
	return {
		width: node.width ?? node.style?.width,
		height: node.height ?? node.style?.height
	};
}
var selector$e = (s) => {
	const { width, height, x, y } = getInternalNodesBounds(s.nodeLookup, { filter: (node) => !!node.selected });
	return {
		width: isNumeric(width) ? width : null,
		height: isNumeric(height) ? height : null,
		userSelectionActive: s.userSelectionActive,
		transformString: `translate(${s.transform[0]}px,${s.transform[1]}px) scale(${s.transform[2]}) translate(${x}px,${y}px)`
	};
};
function NodesSelection({ onSelectionContextMenu, noPanClassName, disableKeyboardA11y }) {
	const store = useStoreApi();
	const { width, height, transformString, userSelectionActive } = useStore(selector$e, shallow$1);
	const moveSelectedNodes = useMoveSelectedNodes();
	const nodeRef = (0, react.useRef)(null);
	(0, react.useEffect)(() => {
		if (!disableKeyboardA11y) nodeRef.current?.focus({ preventScroll: true });
	}, [disableKeyboardA11y]);
	const shouldRender = !userSelectionActive && width !== null && height !== null;
	useDrag({
		nodeRef,
		disabled: !shouldRender
	});
	if (!shouldRender) return null;
	const onContextMenu = onSelectionContextMenu ? (event) => {
		onSelectionContextMenu(event, store.getState().nodes.filter((n) => n.selected));
	} : void 0;
	const onKeyDown = (event) => {
		if (Object.prototype.hasOwnProperty.call(arrowKeyDiffs, event.key)) {
			event.preventDefault();
			moveSelectedNodes({
				direction: arrowKeyDiffs[event.key],
				factor: event.shiftKey ? 4 : 1
			});
		}
	};
	return jsx("div", {
		className: cc([
			"react-flow__nodesselection",
			"react-flow__container",
			noPanClassName
		]),
		style: { transform: transformString },
		children: jsx("div", {
			ref: nodeRef,
			className: "react-flow__nodesselection-rect",
			onContextMenu,
			tabIndex: disableKeyboardA11y ? void 0 : -1,
			onKeyDown: disableKeyboardA11y ? void 0 : onKeyDown,
			style: {
				width,
				height
			}
		})
	});
}
var win = typeof window !== "undefined" ? window : void 0;
var selector$d = (s) => {
	return {
		nodesSelectionActive: s.nodesSelectionActive,
		userSelectionActive: s.userSelectionActive
	};
};
function FlowRendererComponent({ children, onPaneClick, onPaneMouseEnter, onPaneMouseMove, onPaneMouseLeave, onPaneContextMenu, onPaneScroll, paneClickDistance, deleteKeyCode, selectionKeyCode, selectionOnDrag, selectionMode, onSelectionStart, onSelectionEnd, multiSelectionKeyCode, panActivationKeyCode, zoomActivationKeyCode, elementsSelectable, zoomOnScroll, zoomOnPinch, panOnScroll: _panOnScroll, panOnScrollSpeed, panOnScrollMode, zoomOnDoubleClick, panOnDrag: _panOnDrag, autoPanOnSelection, defaultViewport, translateExtent, minZoom, maxZoom, preventScrolling, onSelectionContextMenu, noWheelClassName, noPanClassName, disableKeyboardA11y, onViewportChange, isControlledViewport }) {
	const { nodesSelectionActive, userSelectionActive } = useStore(selector$d, shallow$1);
	const selectionKeyPressed = useKeyPress(selectionKeyCode, { target: win });
	const panActivationKeyPressed = useKeyPress(panActivationKeyCode, { target: win });
	const panOnDrag = panActivationKeyPressed || _panOnDrag;
	const panOnScroll = panActivationKeyPressed || _panOnScroll;
	const _selectionOnDrag = selectionOnDrag && panOnDrag !== true;
	const isSelecting = selectionKeyPressed || userSelectionActive || _selectionOnDrag;
	useGlobalKeyHandler({
		deleteKeyCode,
		multiSelectionKeyCode
	});
	return jsx(ZoomPane, {
		onPaneContextMenu,
		elementsSelectable,
		zoomOnScroll,
		zoomOnPinch,
		panOnScroll,
		panActivationKeyPressed,
		panOnScrollSpeed,
		panOnScrollMode,
		zoomOnDoubleClick,
		panOnDrag: !selectionKeyPressed && panOnDrag,
		defaultViewport,
		translateExtent,
		minZoom,
		maxZoom,
		zoomActivationKeyCode,
		preventScrolling,
		noWheelClassName,
		noPanClassName,
		onViewportChange,
		isControlledViewport,
		paneClickDistance,
		selectionOnDrag: _selectionOnDrag,
		children: jsxs(Pane, {
			onSelectionStart,
			onSelectionEnd,
			onPaneClick,
			onPaneMouseEnter,
			onPaneMouseMove,
			onPaneMouseLeave,
			onPaneContextMenu,
			onPaneScroll,
			panOnDrag,
			autoPanOnSelection,
			isSelecting: !!isSelecting,
			selectionMode,
			selectionKeyPressed,
			paneClickDistance,
			selectionOnDrag: _selectionOnDrag,
			children: [children, nodesSelectionActive && jsx(NodesSelection, {
				onSelectionContextMenu,
				noPanClassName,
				disableKeyboardA11y
			})]
		})
	});
}
FlowRendererComponent.displayName = "FlowRenderer";
var FlowRenderer = (0, react.memo)(FlowRendererComponent);
var selector$c = (onlyRenderVisible) => (s) => {
	return onlyRenderVisible ? getNodesInside(s.nodeLookup, {
		x: 0,
		y: 0,
		width: s.width,
		height: s.height
	}, s.transform, true).map((node) => node.id) : Array.from(s.nodeLookup.keys());
};
/**
* Hook for getting the visible node ids from the store.
*
* @internal
* @param onlyRenderVisible
* @returns array with visible node ids
*/
function useVisibleNodeIds(onlyRenderVisible) {
	return useStore((0, react.useCallback)(selector$c(onlyRenderVisible), [onlyRenderVisible]), shallow$1);
}
var selector$b = (s) => s.updateNodeInternals;
function useResizeObserver() {
	const updateNodeInternals = useStore(selector$b);
	const [resizeObserver] = (0, react.useState)(() => {
		if (typeof ResizeObserver === "undefined") return null;
		return new ResizeObserver((entries) => {
			const updates = /* @__PURE__ */ new Map();
			entries.forEach((entry) => {
				const id = entry.target.getAttribute("data-id");
				updates.set(id, {
					id,
					nodeElement: entry.target,
					force: true
				});
			});
			updateNodeInternals(updates);
		});
	});
	(0, react.useEffect)(() => {
		return () => {
			resizeObserver?.disconnect();
		};
	}, [resizeObserver]);
	return resizeObserver;
}
/**
* Hook to handle the resize observation + internal updates for the passed node.
*
* @internal
* @returns nodeRef - reference to the node element
*/
function useNodeObserver({ node, nodeType, hasDimensions, resizeObserver }) {
	const store = useStoreApi();
	const nodeRef = (0, react.useRef)(null);
	const observedNode = (0, react.useRef)(null);
	const prevSourcePosition = (0, react.useRef)(node.sourcePosition);
	const prevTargetPosition = (0, react.useRef)(node.targetPosition);
	const prevType = (0, react.useRef)(nodeType);
	const isInitialized = hasDimensions && !!node.internals.handleBounds;
	(0, react.useEffect)(() => {
		if (nodeRef.current && !node.hidden && (!isInitialized || observedNode.current !== nodeRef.current)) {
			if (observedNode.current) resizeObserver?.unobserve(observedNode.current);
			resizeObserver?.observe(nodeRef.current);
			observedNode.current = nodeRef.current;
		}
	}, [isInitialized, node.hidden]);
	(0, react.useEffect)(() => {
		return () => {
			if (observedNode.current) {
				resizeObserver?.unobserve(observedNode.current);
				observedNode.current = null;
			}
		};
	}, []);
	(0, react.useEffect)(() => {
		if (nodeRef.current) {
			const typeChanged = prevType.current !== nodeType;
			const sourcePosChanged = prevSourcePosition.current !== node.sourcePosition;
			const targetPosChanged = prevTargetPosition.current !== node.targetPosition;
			if (typeChanged || sourcePosChanged || targetPosChanged) {
				prevType.current = nodeType;
				prevSourcePosition.current = node.sourcePosition;
				prevTargetPosition.current = node.targetPosition;
				store.getState().updateNodeInternals(/* @__PURE__ */ new Map([[node.id, {
					id: node.id,
					nodeElement: nodeRef.current,
					force: true
				}]]));
			}
		}
	}, [
		node.id,
		nodeType,
		node.sourcePosition,
		node.targetPosition
	]);
	return nodeRef;
}
function NodeWrapper({ id, onClick, onMouseEnter, onMouseMove, onMouseLeave, onContextMenu, onDoubleClick, nodesDraggable, elementsSelectable, nodesConnectable, nodesFocusable, resizeObserver, noDragClassName, noPanClassName, disableKeyboardA11y, rfId, nodeTypes, nodeClickDistance, onError }) {
	const { node, internals, isParent } = useStore((s) => {
		const node = s.nodeLookup.get(id);
		const isParent = s.parentLookup.has(id);
		return {
			node,
			internals: node.internals,
			isParent
		};
	}, shallow$1);
	let nodeType = node.type || "default";
	let NodeComponent = nodeTypes?.[nodeType] || builtinNodeTypes[nodeType];
	if (NodeComponent === void 0) {
		onError?.("003", errorMessages["error003"](nodeType));
		nodeType = "default";
		NodeComponent = nodeTypes?.["default"] || builtinNodeTypes.default;
	}
	const isDraggable = !!(node.draggable || nodesDraggable && typeof node.draggable === "undefined");
	const isSelectable = !!(node.selectable || elementsSelectable && typeof node.selectable === "undefined");
	const isConnectable = !!(node.connectable || nodesConnectable && typeof node.connectable === "undefined");
	const isFocusable = !!(node.focusable || nodesFocusable && typeof node.focusable === "undefined");
	const store = useStoreApi();
	const hasDimensions = nodeHasDimensions(node);
	const nodeRef = useNodeObserver({
		node,
		nodeType,
		hasDimensions,
		resizeObserver
	});
	const dragging = useDrag({
		nodeRef,
		disabled: node.hidden || !isDraggable,
		noDragClassName,
		handleSelector: node.dragHandle,
		nodeId: id,
		isSelectable,
		nodeClickDistance
	});
	const moveSelectedNodes = useMoveSelectedNodes();
	if (node.hidden) return null;
	const nodeDimensions = getNodeDimensions(node);
	const inlineDimensions = getNodeInlineStyleDimensions(node);
	const hasPointerEvents = isSelectable || isDraggable || onClick || onMouseEnter || onMouseMove || onMouseLeave;
	const onMouseEnterHandler = onMouseEnter ? (event) => onMouseEnter(event, { ...internals.userNode }) : void 0;
	const onMouseMoveHandler = onMouseMove ? (event) => onMouseMove(event, { ...internals.userNode }) : void 0;
	const onMouseLeaveHandler = onMouseLeave ? (event) => onMouseLeave(event, { ...internals.userNode }) : void 0;
	const onContextMenuHandler = onContextMenu ? (event) => onContextMenu(event, { ...internals.userNode }) : void 0;
	const onDoubleClickHandler = onDoubleClick ? (event) => onDoubleClick(event, { ...internals.userNode }) : void 0;
	const onSelectNodeHandler = (event) => {
		const { selectNodesOnDrag, nodeDragThreshold } = store.getState();
		if (isSelectable && (!selectNodesOnDrag || !isDraggable || nodeDragThreshold > 0)) handleNodeClick({
			id,
			store,
			nodeRef
		});
		if (onClick) onClick(event, { ...internals.userNode });
	};
	const onKeyDown = (event) => {
		if (isInputDOMNode(event.nativeEvent) || disableKeyboardA11y) return;
		if (elementSelectionKeys.includes(event.key) && isSelectable) {
			const unselect = event.key === "Escape";
			handleNodeClick({
				id,
				store,
				unselect,
				nodeRef
			});
		} else if (isDraggable && node.selected && Object.prototype.hasOwnProperty.call(arrowKeyDiffs, event.key)) {
			event.preventDefault();
			const { ariaLabelConfig } = store.getState();
			store.setState({ ariaLiveMessage: ariaLabelConfig["node.a11yDescription.ariaLiveMessage"]({
				direction: event.key.replace("Arrow", "").toLowerCase(),
				x: ~~internals.positionAbsolute.x,
				y: ~~internals.positionAbsolute.y
			}) });
			moveSelectedNodes({
				direction: arrowKeyDiffs[event.key],
				factor: event.shiftKey ? 4 : 1
			});
		}
	};
	const onFocus = () => {
		if (disableKeyboardA11y || !nodeRef.current?.matches(":focus-visible")) return;
		const { transform, width, height, autoPanOnNodeFocus, setCenter } = store.getState();
		if (!autoPanOnNodeFocus) return;
		if (!(getNodesInside(/* @__PURE__ */ new Map([[id, node]]), {
			x: 0,
			y: 0,
			width,
			height
		}, transform, true).length > 0)) setCenter(node.position.x + nodeDimensions.width / 2, node.position.y + nodeDimensions.height / 2, { zoom: transform[2] });
	};
	return jsx("div", {
		className: cc([
			"react-flow__node",
			`react-flow__node-${nodeType}`,
			{ [noPanClassName]: isDraggable },
			node.className,
			{
				selected: node.selected,
				selectable: isSelectable,
				parent: isParent,
				draggable: isDraggable,
				dragging
			}
		]),
		ref: nodeRef,
		style: {
			zIndex: internals.z,
			transform: `translate(${internals.positionAbsolute.x}px,${internals.positionAbsolute.y}px)`,
			pointerEvents: hasPointerEvents ? "all" : "none",
			visibility: hasDimensions ? "visible" : "hidden",
			...node.style,
			...inlineDimensions
		},
		"data-id": id,
		"data-testid": `rf__node-${id}`,
		onMouseEnter: onMouseEnterHandler,
		onMouseMove: onMouseMoveHandler,
		onMouseLeave: onMouseLeaveHandler,
		onContextMenu: onContextMenuHandler,
		onClick: onSelectNodeHandler,
		onDoubleClick: onDoubleClickHandler,
		onKeyDown: isFocusable ? onKeyDown : void 0,
		tabIndex: isFocusable ? 0 : void 0,
		onFocus: isFocusable ? onFocus : void 0,
		role: node.ariaRole ?? (isFocusable ? "group" : void 0),
		"aria-roledescription": "node",
		"aria-describedby": disableKeyboardA11y ? void 0 : `${ARIA_NODE_DESC_KEY}-${rfId}`,
		"aria-label": node.ariaLabel,
		...node.domAttributes,
		children: jsx(Provider, {
			value: id,
			children: jsx(NodeComponent, {
				id,
				data: node.data,
				type: nodeType,
				positionAbsoluteX: internals.positionAbsolute.x,
				positionAbsoluteY: internals.positionAbsolute.y,
				selected: node.selected ?? false,
				selectable: isSelectable,
				draggable: isDraggable,
				deletable: node.deletable ?? true,
				isConnectable,
				sourcePosition: node.sourcePosition,
				targetPosition: node.targetPosition,
				dragging,
				dragHandle: node.dragHandle,
				zIndex: internals.z,
				parentId: node.parentId,
				...nodeDimensions
			})
		})
	});
}
var NodeWrapper$1 = (0, react.memo)(NodeWrapper);
var selector$a = (s) => ({
	nodesConnectable: s.nodesConnectable,
	nodesFocusable: s.nodesFocusable,
	elementsSelectable: s.elementsSelectable,
	onError: s.onError
});
function NodeRendererComponent(props) {
	const { nodesConnectable, nodesFocusable, elementsSelectable, onError } = useStore(selector$a, shallow$1);
	const nodeIds = useVisibleNodeIds(props.onlyRenderVisibleElements);
	const resizeObserver = useResizeObserver();
	return jsx("div", {
		className: "react-flow__nodes",
		style: containerStyle,
		children: nodeIds.map((nodeId) => {
			return jsx(NodeWrapper$1, {
				id: nodeId,
				nodeTypes: props.nodeTypes,
				nodeExtent: props.nodeExtent,
				onClick: props.onNodeClick,
				onMouseEnter: props.onNodeMouseEnter,
				onMouseMove: props.onNodeMouseMove,
				onMouseLeave: props.onNodeMouseLeave,
				onContextMenu: props.onNodeContextMenu,
				onDoubleClick: props.onNodeDoubleClick,
				noDragClassName: props.noDragClassName,
				noPanClassName: props.noPanClassName,
				rfId: props.rfId,
				disableKeyboardA11y: props.disableKeyboardA11y,
				resizeObserver,
				nodesDraggable: props.nodesDraggable ?? true,
				nodesConnectable,
				nodesFocusable,
				elementsSelectable,
				nodeClickDistance: props.nodeClickDistance,
				onError
			}, nodeId);
		})
	});
}
NodeRendererComponent.displayName = "NodeRenderer";
var NodeRenderer = (0, react.memo)(NodeRendererComponent);
/**
* Hook for getting the visible edge ids from the store.
*
* @internal
* @param onlyRenderVisible
* @returns array with visible edge ids
*/
function useVisibleEdgeIds(onlyRenderVisible) {
	return useStore((0, react.useCallback)((s) => {
		if (!onlyRenderVisible) return s.edges.map((edge) => edge.id);
		const visibleEdgeIds = [];
		if (s.width && s.height) for (const edge of s.edges) {
			const sourceNode = s.nodeLookup.get(edge.source);
			const targetNode = s.nodeLookup.get(edge.target);
			if (sourceNode && targetNode && isEdgeVisible({
				sourceNode,
				targetNode,
				width: s.width,
				height: s.height,
				transform: s.transform
			})) visibleEdgeIds.push(edge.id);
		}
		return visibleEdgeIds;
	}, [onlyRenderVisible]), shallow$1);
}
var ArrowSymbol = ({ color = "none", strokeWidth = 1 }) => {
	return jsx("polyline", {
		className: "arrow",
		style: {
			strokeWidth,
			...color && { stroke: color }
		},
		strokeLinecap: "round",
		fill: "none",
		strokeLinejoin: "round",
		points: "-5,-4 0,0 -5,4"
	});
};
var ArrowClosedSymbol = ({ color = "none", strokeWidth = 1 }) => {
	return jsx("polyline", {
		className: "arrowclosed",
		style: {
			strokeWidth,
			...color && {
				stroke: color,
				fill: color
			}
		},
		strokeLinecap: "round",
		strokeLinejoin: "round",
		points: "-5,-4 0,0 -5,4 -5,-4"
	});
};
var MarkerSymbols = {
	[MarkerType.Arrow]: ArrowSymbol,
	[MarkerType.ArrowClosed]: ArrowClosedSymbol
};
function useMarkerSymbol(type) {
	const store = useStoreApi();
	return (0, react.useMemo)(() => {
		if (!Object.prototype.hasOwnProperty.call(MarkerSymbols, type)) {
			store.getState().onError?.("009", errorMessages["error009"](type));
			return null;
		}
		return MarkerSymbols[type];
	}, [type]);
}
var Marker = ({ id, type, color, width = 12.5, height = 12.5, markerUnits = "strokeWidth", strokeWidth, orient = "auto-start-reverse" }) => {
	const Symbol = useMarkerSymbol(type);
	if (!Symbol) return null;
	return jsx("marker", {
		className: "react-flow__arrowhead",
		id,
		markerWidth: `${width}`,
		markerHeight: `${height}`,
		viewBox: "-10 -10 20 20",
		markerUnits,
		orient,
		refX: "0",
		refY: "0",
		children: jsx(Symbol, {
			color,
			strokeWidth
		})
	});
};
var MarkerDefinitions = ({ defaultColor, rfId }) => {
	const edges = useStore((s) => s.edges);
	const defaultEdgeOptions = useStore((s) => s.defaultEdgeOptions);
	const markers = (0, react.useMemo)(() => {
		return createMarkerIds(edges, {
			id: rfId,
			defaultColor,
			defaultMarkerStart: defaultEdgeOptions?.markerStart,
			defaultMarkerEnd: defaultEdgeOptions?.markerEnd
		});
	}, [
		edges,
		defaultEdgeOptions,
		rfId,
		defaultColor
	]);
	if (!markers.length) return null;
	return jsx("svg", {
		className: "react-flow__marker",
		"aria-hidden": "true",
		children: jsx("defs", { children: markers.map((marker) => jsx(Marker, {
			id: marker.id,
			type: marker.type,
			color: marker.color,
			width: marker.width,
			height: marker.height,
			markerUnits: marker.markerUnits,
			strokeWidth: marker.strokeWidth,
			orient: marker.orient
		}, marker.id)) })
	});
};
MarkerDefinitions.displayName = "MarkerDefinitions";
var MarkerDefinitions$1 = (0, react.memo)(MarkerDefinitions);
function EdgeTextComponent({ x, y, label, labelStyle, labelShowBg = true, labelBgStyle, labelBgPadding = [2, 4], labelBgBorderRadius = 2, children, className, ...rest }) {
	const [edgeTextBbox, setEdgeTextBbox] = (0, react.useState)({
		x: 1,
		y: 0,
		width: 0,
		height: 0
	});
	const edgeTextClasses = cc(["react-flow__edge-textwrapper", className]);
	const edgeTextRef = (0, react.useRef)(null);
	(0, react.useEffect)(() => {
		if (edgeTextRef.current) {
			const textBbox = edgeTextRef.current.getBBox();
			setEdgeTextBbox({
				x: textBbox.x,
				y: textBbox.y,
				width: textBbox.width,
				height: textBbox.height
			});
		}
	}, [label]);
	if (!label) return null;
	return jsxs("g", {
		transform: `translate(${x - edgeTextBbox.width / 2} ${y - edgeTextBbox.height / 2})`,
		className: edgeTextClasses,
		visibility: edgeTextBbox.width ? "visible" : "hidden",
		...rest,
		children: [
			labelShowBg && jsx("rect", {
				width: edgeTextBbox.width + 2 * labelBgPadding[0],
				x: -labelBgPadding[0],
				y: -labelBgPadding[1],
				height: edgeTextBbox.height + 2 * labelBgPadding[1],
				className: "react-flow__edge-textbg",
				style: labelBgStyle,
				rx: labelBgBorderRadius,
				ry: labelBgBorderRadius
			}),
			jsx("text", {
				className: "react-flow__edge-text",
				y: edgeTextBbox.height / 2,
				dy: "0.3em",
				ref: edgeTextRef,
				style: labelStyle,
				children: label
			}),
			children
		]
	});
}
EdgeTextComponent.displayName = "EdgeText";
/**
* You can use the `<EdgeText />` component as a helper component to display text
* within your custom edges.
*
* @public
*
* @example
* ```jsx
* import { EdgeText } from '@xyflow/react';
*
* export function CustomEdgeLabel({ label }) {
*   return (
*     <EdgeText
*       x={100}
*       y={100}
*       label={label}
*       labelStyle={{ fill: 'white' }}
*       labelShowBg
*       labelBgStyle={{ fill: 'red' }}
*       labelBgPadding={[2, 4]}
*       labelBgBorderRadius={2}
*     />
*   );
* }
*```
*/
var EdgeText = (0, react.memo)(EdgeTextComponent);
/**
* The `<BaseEdge />` component gets used internally for all the edges. It can be
* used inside a custom edge and handles the invisible helper edge and the edge label
* for you.
*
* @public
* @example
* ```jsx
*import { BaseEdge } from '@xyflow/react';
*
*export function CustomEdge({ sourceX, sourceY, targetX, targetY, ...props }) {
*  const [edgePath] = getStraightPath({
*    sourceX,
*    sourceY,
*    targetX,
*    targetY,
*  });
*
*  return <BaseEdge path={edgePath} {...props} />;
*}
*```
*
* @remarks If you want to use an edge marker with the [`<BaseEdge />`](/api-reference/components/base-edge) component,
* you can pass the `markerStart` or `markerEnd` props passed to your custom edge
* through to the [`<BaseEdge />`](/api-reference/components/base-edge) component.
* You can see all the props passed to a custom edge by looking at the [`EdgeProps`](/api-reference/types/edge-props) type.
*/
function BaseEdge({ path, labelX, labelY, label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius, interactionWidth = 20, ...props }) {
	return jsxs(Fragment, { children: [
		jsx("path", {
			...props,
			d: path,
			fill: "none",
			className: cc(["react-flow__edge-path", props.className])
		}),
		interactionWidth ? jsx("path", {
			d: path,
			fill: "none",
			strokeOpacity: 0,
			strokeWidth: interactionWidth,
			className: "react-flow__edge-interaction"
		}) : null,
		label && isNumeric(labelX) && isNumeric(labelY) ? jsx(EdgeText, {
			x: labelX,
			y: labelY,
			label,
			labelStyle,
			labelShowBg,
			labelBgStyle,
			labelBgPadding,
			labelBgBorderRadius
		}) : null
	] });
}
function getControl({ pos, x1, y1, x2, y2 }) {
	if (pos === Position.Left || pos === Position.Right) return [.5 * (x1 + x2), y1];
	return [x1, .5 * (y1 + y2)];
}
/**
* The `getSimpleBezierPath` util returns everything you need to render a simple
* bezier edge between two nodes.
* @public
* @returns
* - `path`: the path to use in an SVG `<path>` element.
* - `labelX`: the `x` position you can use to render a label for this edge.
* - `labelY`: the `y` position you can use to render a label for this edge.
* - `offsetX`: the absolute difference between the source `x` position and the `x` position of the
* middle of this path.
* - `offsetY`: the absolute difference between the source `y` position and the `y` position of the
* middle of this path.
*/
function getSimpleBezierPath({ sourceX, sourceY, sourcePosition = Position.Bottom, targetX, targetY, targetPosition = Position.Top }) {
	const [sourceControlX, sourceControlY] = getControl({
		pos: sourcePosition,
		x1: sourceX,
		y1: sourceY,
		x2: targetX,
		y2: targetY
	});
	const [targetControlX, targetControlY] = getControl({
		pos: targetPosition,
		x1: targetX,
		y1: targetY,
		x2: sourceX,
		y2: sourceY
	});
	const [labelX, labelY, offsetX, offsetY] = getBezierEdgeCenter({
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourceControlX,
		sourceControlY,
		targetControlX,
		targetControlY
	});
	return [
		`M${sourceX},${sourceY} C${sourceControlX},${sourceControlY} ${targetControlX},${targetControlY} ${targetX},${targetY}`,
		labelX,
		labelY,
		offsetX,
		offsetY
	];
}
function createSimpleBezierEdge(params) {
	return (0, react.memo)(({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius, style, markerEnd, markerStart, interactionWidth }) => {
		const [path, labelX, labelY] = getSimpleBezierPath({
			sourceX,
			sourceY,
			sourcePosition,
			targetX,
			targetY,
			targetPosition
		});
		return jsx(BaseEdge, {
			id: params.isInternal ? void 0 : id,
			path,
			labelX,
			labelY,
			label,
			labelStyle,
			labelShowBg,
			labelBgStyle,
			labelBgPadding,
			labelBgBorderRadius,
			style,
			markerEnd,
			markerStart,
			interactionWidth
		});
	});
}
var SimpleBezierEdge = createSimpleBezierEdge({ isInternal: false });
var SimpleBezierEdgeInternal = createSimpleBezierEdge({ isInternal: true });
SimpleBezierEdge.displayName = "SimpleBezierEdge";
SimpleBezierEdgeInternal.displayName = "SimpleBezierEdgeInternal";
function createSmoothStepEdge(params) {
	return (0, react.memo)(({ id, sourceX, sourceY, targetX, targetY, label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius, style, sourcePosition = Position.Bottom, targetPosition = Position.Top, markerEnd, markerStart, pathOptions, interactionWidth }) => {
		const [path, labelX, labelY] = getSmoothStepPath({
			sourceX,
			sourceY,
			sourcePosition,
			targetX,
			targetY,
			targetPosition,
			borderRadius: pathOptions?.borderRadius,
			offset: pathOptions?.offset,
			stepPosition: pathOptions?.stepPosition
		});
		return jsx(BaseEdge, {
			id: params.isInternal ? void 0 : id,
			path,
			labelX,
			labelY,
			label,
			labelStyle,
			labelShowBg,
			labelBgStyle,
			labelBgPadding,
			labelBgBorderRadius,
			style,
			markerEnd,
			markerStart,
			interactionWidth
		});
	});
}
/**
* Component that can be used inside a custom edge to render a smooth step edge.
*
* @public
* @example
*
* ```tsx
* import { SmoothStepEdge } from '@xyflow/react';
*
* function CustomEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }) {
*   return (
*     <SmoothStepEdge
*       sourceX={sourceX}
*       sourceY={sourceY}
*       targetX={targetX}
*       targetY={targetY}
*       sourcePosition={sourcePosition}
*       targetPosition={targetPosition}
*     />
*   );
* }
* ```
*/
var SmoothStepEdge = createSmoothStepEdge({ isInternal: false });
/**
* @internal
*/
var SmoothStepEdgeInternal = createSmoothStepEdge({ isInternal: true });
SmoothStepEdge.displayName = "SmoothStepEdge";
SmoothStepEdgeInternal.displayName = "SmoothStepEdgeInternal";
function createStepEdge(params) {
	return (0, react.memo)(({ id, ...props }) => {
		const _id = params.isInternal ? void 0 : id;
		return jsx(SmoothStepEdge, {
			...props,
			id: _id,
			pathOptions: (0, react.useMemo)(() => ({
				borderRadius: 0,
				offset: props.pathOptions?.offset
			}), [props.pathOptions?.offset])
		});
	});
}
/**
* Component that can be used inside a custom edge to render a step edge.
*
* @public
* @example
*
* ```tsx
* import { StepEdge } from '@xyflow/react';
*
* function CustomEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }) {
*   return (
*     <StepEdge
*       sourceX={sourceX}
*       sourceY={sourceY}
*       targetX={targetX}
*       targetY={targetY}
*       sourcePosition={sourcePosition}
*       targetPosition={targetPosition}
*     />
*   );
* }
* ```
*/
var StepEdge = createStepEdge({ isInternal: false });
/**
* @internal
*/
var StepEdgeInternal = createStepEdge({ isInternal: true });
StepEdge.displayName = "StepEdge";
StepEdgeInternal.displayName = "StepEdgeInternal";
function createStraightEdge(params) {
	return (0, react.memo)(({ id, sourceX, sourceY, targetX, targetY, label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius, style, markerEnd, markerStart, interactionWidth }) => {
		const [path, labelX, labelY] = getStraightPath({
			sourceX,
			sourceY,
			targetX,
			targetY
		});
		return jsx(BaseEdge, {
			id: params.isInternal ? void 0 : id,
			path,
			labelX,
			labelY,
			label,
			labelStyle,
			labelShowBg,
			labelBgStyle,
			labelBgPadding,
			labelBgBorderRadius,
			style,
			markerEnd,
			markerStart,
			interactionWidth
		});
	});
}
/**
* Component that can be used inside a custom edge to render a straight line.
*
* @public
* @example
*
* ```tsx
* import { StraightEdge } from '@xyflow/react';
*
* function CustomEdge({ sourceX, sourceY, targetX, targetY }) {
*   return (
*     <StraightEdge
*       sourceX={sourceX}
*       sourceY={sourceY}
*       targetX={targetX}
*       targetY={targetY}
*     />
*   );
* }
* ```
*/
var StraightEdge = createStraightEdge({ isInternal: false });
/**
* @internal
*/
var StraightEdgeInternal = createStraightEdge({ isInternal: true });
StraightEdge.displayName = "StraightEdge";
StraightEdgeInternal.displayName = "StraightEdgeInternal";
function createBezierEdge(params) {
	return (0, react.memo)(({ id, sourceX, sourceY, targetX, targetY, sourcePosition = Position.Bottom, targetPosition = Position.Top, label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius, style, markerEnd, markerStart, pathOptions, interactionWidth }) => {
		const [path, labelX, labelY] = getBezierPath({
			sourceX,
			sourceY,
			sourcePosition,
			targetX,
			targetY,
			targetPosition,
			curvature: pathOptions?.curvature
		});
		return jsx(BaseEdge, {
			id: params.isInternal ? void 0 : id,
			path,
			labelX,
			labelY,
			label,
			labelStyle,
			labelShowBg,
			labelBgStyle,
			labelBgPadding,
			labelBgBorderRadius,
			style,
			markerEnd,
			markerStart,
			interactionWidth
		});
	});
}
/**
* Component that can be used inside a custom edge to render a bezier curve.
*
* @public
* @example
*
* ```tsx
* import { BezierEdge } from '@xyflow/react';
*
* function CustomEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }) {
*   return (
*     <BezierEdge
*       sourceX={sourceX}
*       sourceY={sourceY}
*       targetX={targetX}
*       targetY={targetY}
*       sourcePosition={sourcePosition}
*       targetPosition={targetPosition}
*     />
*   );
* }
* ```
*/
var BezierEdge = createBezierEdge({ isInternal: false });
/**
* @internal
*/
var BezierEdgeInternal = createBezierEdge({ isInternal: true });
BezierEdge.displayName = "BezierEdge";
BezierEdgeInternal.displayName = "BezierEdgeInternal";
var builtinEdgeTypes = {
	default: BezierEdgeInternal,
	straight: StraightEdgeInternal,
	step: StepEdgeInternal,
	smoothstep: SmoothStepEdgeInternal,
	simplebezier: SimpleBezierEdgeInternal
};
var nullPosition = {
	sourceX: null,
	sourceY: null,
	targetX: null,
	targetY: null,
	sourcePosition: null,
	targetPosition: null,
	zIndex: void 0
};
var shiftX = (x, shift, position) => {
	if (position === Position.Left) return x - shift;
	if (position === Position.Right) return x + shift;
	return x;
};
var shiftY = (y, shift, position) => {
	if (position === Position.Top) return y - shift;
	if (position === Position.Bottom) return y + shift;
	return y;
};
var EdgeUpdaterClassName = "react-flow__edgeupdater";
/**
* @internal
*/
function EdgeAnchor({ position, centerX, centerY, radius = 10, onMouseDown, onMouseEnter, onMouseOut, type }) {
	return jsx("circle", {
		onMouseDown,
		onMouseEnter,
		onMouseOut,
		className: cc([EdgeUpdaterClassName, `${EdgeUpdaterClassName}-${type}`]),
		cx: shiftX(centerX, radius, position),
		cy: shiftY(centerY, radius, position),
		r: radius,
		stroke: "transparent",
		fill: "transparent"
	});
}
function EdgeUpdateAnchors({ isReconnectable, reconnectRadius, edge, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, onReconnect, onReconnectStart, onReconnectEnd, setReconnecting, setUpdateHover }) {
	const store = useStoreApi();
	const handleEdgeUpdater = (event, oppositeHandle) => {
		if (event.button !== 0) return;
		const { autoPanOnConnect, domNode, connectionMode, connectionRadius, lib, onConnectStart, cancelConnection, nodeLookup, rfId: flowId, panBy, updateConnection } = store.getState();
		const isTarget = oppositeHandle.type === "target";
		const _onReconnectEnd = (evt, connectionState) => {
			setReconnecting(false);
			onReconnectEnd?.(evt, edge, oppositeHandle.type, connectionState);
		};
		const onConnectEdge = (connection) => onReconnect?.(edge, connection);
		const _onConnectStart = (_event, params) => {
			setReconnecting(true);
			onReconnectStart?.(event, edge, oppositeHandle.type);
			onConnectStart?.(_event, params);
		};
		XYHandle.onPointerDown(event.nativeEvent, {
			autoPanOnConnect,
			connectionMode,
			connectionRadius,
			domNode,
			handleId: oppositeHandle.id,
			nodeId: oppositeHandle.nodeId,
			nodeLookup,
			isTarget,
			edgeUpdaterType: oppositeHandle.type,
			lib,
			flowId,
			cancelConnection,
			panBy,
			isValidConnection: (...args) => store.getState().isValidConnection?.(...args) ?? true,
			onConnect: onConnectEdge,
			onConnectStart: _onConnectStart,
			onConnectEnd: (...args) => store.getState().onConnectEnd?.(...args),
			onReconnectEnd: _onReconnectEnd,
			updateConnection,
			getTransform: () => store.getState().transform,
			getFromHandle: () => store.getState().connection.fromHandle,
			dragThreshold: store.getState().connectionDragThreshold,
			handleDomNode: event.currentTarget
		});
	};
	const onReconnectSourceMouseDown = (event) => handleEdgeUpdater(event, {
		nodeId: edge.target,
		id: edge.targetHandle ?? null,
		type: "target"
	});
	const onReconnectTargetMouseDown = (event) => handleEdgeUpdater(event, {
		nodeId: edge.source,
		id: edge.sourceHandle ?? null,
		type: "source"
	});
	const onReconnectMouseEnter = () => setUpdateHover(true);
	const onReconnectMouseOut = () => setUpdateHover(false);
	return jsxs(Fragment, { children: [(isReconnectable === true || isReconnectable === "source") && jsx(EdgeAnchor, {
		position: sourcePosition,
		centerX: sourceX,
		centerY: sourceY,
		radius: reconnectRadius,
		onMouseDown: onReconnectSourceMouseDown,
		onMouseEnter: onReconnectMouseEnter,
		onMouseOut: onReconnectMouseOut,
		type: "source"
	}), (isReconnectable === true || isReconnectable === "target") && jsx(EdgeAnchor, {
		position: targetPosition,
		centerX: targetX,
		centerY: targetY,
		radius: reconnectRadius,
		onMouseDown: onReconnectTargetMouseDown,
		onMouseEnter: onReconnectMouseEnter,
		onMouseOut: onReconnectMouseOut,
		type: "target"
	})] });
}
function EdgeWrapper({ id, edgesFocusable, edgesReconnectable, elementsSelectable, onClick, onDoubleClick, onContextMenu, onMouseEnter, onMouseMove, onMouseLeave, reconnectRadius, onReconnect, onReconnectStart, onReconnectEnd, rfId, edgeTypes, noPanClassName, onError, disableKeyboardA11y }) {
	let edge = useStore((s) => s.edgeLookup.get(id));
	const defaultEdgeOptions = useStore((s) => s.defaultEdgeOptions);
	edge = defaultEdgeOptions ? {
		...defaultEdgeOptions,
		...edge
	} : edge;
	let edgeType = edge.type || "default";
	let EdgeComponent = edgeTypes?.[edgeType] || builtinEdgeTypes[edgeType];
	if (EdgeComponent === void 0) {
		onError?.("011", errorMessages["error011"](edgeType));
		edgeType = "default";
		EdgeComponent = edgeTypes?.["default"] || builtinEdgeTypes.default;
	}
	const isFocusable = !!(edge.focusable || edgesFocusable && typeof edge.focusable === "undefined");
	const isReconnectable = typeof onReconnect !== "undefined" && (edge.reconnectable || edgesReconnectable && typeof edge.reconnectable === "undefined");
	const isSelectable = !!(edge.selectable || elementsSelectable && typeof edge.selectable === "undefined");
	const edgeRef = (0, react.useRef)(null);
	const [updateHover, setUpdateHover] = (0, react.useState)(false);
	const [reconnecting, setReconnecting] = (0, react.useState)(false);
	const store = useStoreApi();
	const { zIndex = edge.zIndex, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = useStore((0, react.useCallback)((store) => {
		const sourceNode = store.nodeLookup.get(edge.source);
		const targetNode = store.nodeLookup.get(edge.target);
		if (!sourceNode || !targetNode) return nullPosition;
		const edgePosition = getEdgePosition({
			id,
			sourceNode,
			targetNode,
			sourceHandle: edge.sourceHandle || null,
			targetHandle: edge.targetHandle || null,
			connectionMode: store.connectionMode,
			onError
		});
		const zIndex = getElevatedEdgeZIndex({
			selected: edge.selected,
			zIndex: edge.zIndex,
			sourceNode,
			targetNode,
			elevateOnSelect: store.elevateEdgesOnSelect,
			zIndexMode: store.zIndexMode
		});
		return {
			...edgePosition || nullPosition,
			zIndex
		};
	}, [
		edge.source,
		edge.target,
		edge.sourceHandle,
		edge.targetHandle,
		edge.selected,
		edge.zIndex,
		onError
	]), shallow$1);
	const markerStartUrl = (0, react.useMemo)(() => edge.markerStart ? `url('#${getMarkerId(edge.markerStart, rfId)}')` : void 0, [edge.markerStart, rfId]);
	const markerEndUrl = (0, react.useMemo)(() => edge.markerEnd ? `url('#${getMarkerId(edge.markerEnd, rfId)}')` : void 0, [edge.markerEnd, rfId]);
	if (edge.hidden || sourceX === null || sourceY === null || targetX === null || targetY === null) return null;
	const onEdgeClick = (event) => {
		const { addSelectedEdges, unselectNodesAndEdges, multiSelectionActive } = store.getState();
		if (isSelectable) {
			store.setState({ nodesSelectionActive: false });
			if (edge.selected && multiSelectionActive) {
				unselectNodesAndEdges({
					nodes: [],
					edges: [edge]
				});
				edgeRef.current?.blur();
			} else addSelectedEdges([id]);
		}
		if (onClick) onClick(event, edge);
	};
	const onEdgeDoubleClick = onDoubleClick ? (event) => {
		onDoubleClick(event, { ...edge });
	} : void 0;
	const onEdgeContextMenu = onContextMenu ? (event) => {
		onContextMenu(event, { ...edge });
	} : void 0;
	const onEdgeMouseEnter = onMouseEnter ? (event) => {
		onMouseEnter(event, { ...edge });
	} : void 0;
	const onEdgeMouseMove = onMouseMove ? (event) => {
		onMouseMove(event, { ...edge });
	} : void 0;
	const onEdgeMouseLeave = onMouseLeave ? (event) => {
		onMouseLeave(event, { ...edge });
	} : void 0;
	const onKeyDown = (event) => {
		if (!disableKeyboardA11y && elementSelectionKeys.includes(event.key) && isSelectable) {
			const { unselectNodesAndEdges, addSelectedEdges } = store.getState();
			if (event.key === "Escape") {
				edgeRef.current?.blur();
				unselectNodesAndEdges({ edges: [edge] });
			} else addSelectedEdges([id]);
		}
	};
	return jsx("svg", {
		style: { zIndex },
		children: jsxs("g", {
			className: cc([
				"react-flow__edge",
				`react-flow__edge-${edgeType}`,
				edge.className,
				noPanClassName,
				{
					selected: edge.selected,
					animated: edge.animated,
					inactive: !isSelectable && !onClick,
					updating: updateHover,
					selectable: isSelectable
				}
			]),
			onClick: onEdgeClick,
			onDoubleClick: onEdgeDoubleClick,
			onContextMenu: onEdgeContextMenu,
			onMouseEnter: onEdgeMouseEnter,
			onMouseMove: onEdgeMouseMove,
			onMouseLeave: onEdgeMouseLeave,
			onKeyDown: isFocusable ? onKeyDown : void 0,
			tabIndex: isFocusable ? 0 : void 0,
			role: edge.ariaRole ?? (isFocusable ? "group" : "img"),
			"aria-roledescription": "edge",
			"data-id": id,
			"data-testid": `rf__edge-${id}`,
			"aria-label": edge.ariaLabel === null ? void 0 : edge.ariaLabel || `Edge from ${edge.source} to ${edge.target}`,
			"aria-describedby": isFocusable ? `${ARIA_EDGE_DESC_KEY}-${rfId}` : void 0,
			ref: edgeRef,
			...edge.domAttributes,
			children: [!reconnecting && jsx(EdgeComponent, {
				id,
				source: edge.source,
				target: edge.target,
				type: edge.type,
				selected: edge.selected,
				animated: edge.animated,
				selectable: isSelectable,
				deletable: edge.deletable ?? true,
				label: edge.label,
				labelStyle: edge.labelStyle,
				labelShowBg: edge.labelShowBg,
				labelBgStyle: edge.labelBgStyle,
				labelBgPadding: edge.labelBgPadding,
				labelBgBorderRadius: edge.labelBgBorderRadius,
				sourceX,
				sourceY,
				targetX,
				targetY,
				sourcePosition,
				targetPosition,
				data: edge.data,
				style: edge.style,
				sourceHandleId: edge.sourceHandle,
				targetHandleId: edge.targetHandle,
				markerStart: markerStartUrl,
				markerEnd: markerEndUrl,
				pathOptions: "pathOptions" in edge ? edge.pathOptions : void 0,
				interactionWidth: edge.interactionWidth
			}), isReconnectable && jsx(EdgeUpdateAnchors, {
				edge,
				isReconnectable,
				reconnectRadius,
				onReconnect,
				onReconnectStart,
				onReconnectEnd,
				sourceX,
				sourceY,
				targetX,
				targetY,
				sourcePosition,
				targetPosition,
				setUpdateHover,
				setReconnecting
			})]
		})
	});
}
var EdgeWrapper$1 = (0, react.memo)(EdgeWrapper);
var selector$9 = (s) => ({
	edgesFocusable: s.edgesFocusable,
	edgesReconnectable: s.edgesReconnectable,
	elementsSelectable: s.elementsSelectable,
	connectionMode: s.connectionMode,
	onError: s.onError
});
function EdgeRendererComponent({ defaultMarkerColor, onlyRenderVisibleElements, rfId, edgeTypes, noPanClassName, onReconnect, onEdgeContextMenu, onEdgeMouseEnter, onEdgeMouseMove, onEdgeMouseLeave, onEdgeClick, reconnectRadius, onEdgeDoubleClick, onReconnectStart, onReconnectEnd, disableKeyboardA11y }) {
	const { edgesFocusable, edgesReconnectable, elementsSelectable, onError } = useStore(selector$9, shallow$1);
	const edgeIds = useVisibleEdgeIds(onlyRenderVisibleElements);
	return jsxs("div", {
		className: "react-flow__edges",
		children: [jsx(MarkerDefinitions$1, {
			defaultColor: defaultMarkerColor,
			rfId
		}), edgeIds.map((id) => {
			return jsx(EdgeWrapper$1, {
				id,
				edgesFocusable,
				edgesReconnectable,
				elementsSelectable,
				noPanClassName,
				onReconnect,
				onContextMenu: onEdgeContextMenu,
				onMouseEnter: onEdgeMouseEnter,
				onMouseMove: onEdgeMouseMove,
				onMouseLeave: onEdgeMouseLeave,
				onClick: onEdgeClick,
				reconnectRadius,
				onDoubleClick: onEdgeDoubleClick,
				onReconnectStart,
				onReconnectEnd,
				rfId,
				onError,
				edgeTypes,
				disableKeyboardA11y
			}, id);
		})]
	});
}
EdgeRendererComponent.displayName = "EdgeRenderer";
var EdgeRenderer = (0, react.memo)(EdgeRendererComponent);
var toTransformString = (transform) => `translate(${transform[0]}px,${transform[1]}px) scale(${transform[2]})`;
function Viewport({ children }) {
	const store = useStoreApi();
	const viewportRef = (0, react.useRef)(null);
	const [initialTransform] = (0, react.useState)(() => store.getState().transform);
	useIsomorphicLayoutEffect(() => {
		let prevTransform = null;
		const applyTransform = () => {
			const transform = store.getState().transform;
			if (prevTransform && transform[0] === prevTransform[0] && transform[1] === prevTransform[1] && transform[2] === prevTransform[2]) return;
			prevTransform = transform;
			if (viewportRef.current) viewportRef.current.style.transform = toTransformString(transform);
		};
		applyTransform();
		return store.subscribe(applyTransform);
	}, [store]);
	return jsx("div", {
		ref: viewportRef,
		className: "react-flow__viewport xyflow__viewport react-flow__container",
		style: { transform: toTransformString(initialTransform) },
		children
	});
}
/**
* Hook for calling onInit handler.
*
* @internal
*/
function useOnInitHandler(onInit) {
	const rfInstance = useReactFlow();
	const isInitialized = (0, react.useRef)(false);
	(0, react.useEffect)(() => {
		if (!isInitialized.current && rfInstance.viewportInitialized && onInit) {
			setTimeout(() => onInit(rfInstance), 1);
			isInitialized.current = true;
		}
	}, [onInit, rfInstance.viewportInitialized]);
}
var selector$8 = (state) => state.panZoom?.syncViewport;
/**
* Hook for syncing the viewport with the panzoom instance.
*
* @internal
* @param viewport
*/
function useViewportSync(viewport) {
	const syncViewport = useStore(selector$8);
	const store = useStoreApi();
	(0, react.useEffect)(() => {
		if (viewport) {
			syncViewport?.(viewport);
			store.setState({ transform: [
				viewport.x,
				viewport.y,
				viewport.zoom
			] });
		}
	}, [viewport, syncViewport]);
	return null;
}
function storeSelector$1(s) {
	return s.connection.inProgress ? {
		...s.connection,
		to: pointToRendererPoint(s.connection.to, s.transform)
	} : { ...s.connection };
}
function getSelector(connectionSelector) {
	if (connectionSelector) {
		const combinedSelector = (s) => {
			return connectionSelector(storeSelector$1(s));
		};
		return combinedSelector;
	}
	return storeSelector$1;
}
/**
* The `useConnection` hook returns the current connection when there is an active
* connection interaction. If no connection interaction is active, it returns null
* for every property. A typical use case for this hook is to colorize handles
* based on a certain condition (e.g. if the connection is valid or not).
*
* @public
* @param connectionSelector - An optional selector function used to extract a slice of the
* `ConnectionState` data. Using a selector can prevent component re-renders where data you don't
* otherwise care about might change. If a selector is not provided, the entire `ConnectionState`
* object is returned unchanged.
* @example
*
* ```tsx
*import { useConnection } from '@xyflow/react';
*
*function App() {
*  const connection = useConnection();
*
*  return (
*    <div> {connection ? `Someone is trying to make a connection from ${connection.fromNode} to this one.` : 'There are currently no incoming connections!'}
*
*   </div>
*   );
* }
* ```
*
* @returns ConnectionState
*/
function useConnection(connectionSelector) {
	return useStore(getSelector(connectionSelector), shallow$1);
}
var selector$7 = (s) => ({
	nodesConnectable: s.nodesConnectable,
	isValid: s.connection.isValid,
	inProgress: s.connection.inProgress,
	width: s.width,
	height: s.height
});
function ConnectionLineWrapper({ containerStyle, style, type, component }) {
	const { nodesConnectable, width, height, isValid, inProgress } = useStore(selector$7, shallow$1);
	if (!!!(width && nodesConnectable && inProgress)) return null;
	return jsx("svg", {
		style: containerStyle,
		width,
		height,
		className: "react-flow__connectionline react-flow__container",
		children: jsx("g", {
			className: cc(["react-flow__connection", getConnectionStatus(isValid)]),
			children: jsx(ConnectionLine, {
				style,
				type,
				CustomComponent: component,
				isValid
			})
		})
	});
}
var ConnectionLine = ({ style, type = ConnectionLineType.Bezier, CustomComponent, isValid }) => {
	const { inProgress, from, fromNode, fromHandle, fromPosition, to, toNode, toHandle, toPosition, pointer } = useConnection();
	if (!inProgress) return;
	if (CustomComponent) return jsx(CustomComponent, {
		connectionLineType: type,
		connectionLineStyle: style,
		fromNode,
		fromHandle,
		fromX: from.x,
		fromY: from.y,
		toX: to.x,
		toY: to.y,
		fromPosition,
		toPosition,
		connectionStatus: getConnectionStatus(isValid),
		toNode,
		toHandle,
		pointer
	});
	let path = "";
	const pathParams = {
		sourceX: from.x,
		sourceY: from.y,
		sourcePosition: fromPosition,
		targetX: to.x,
		targetY: to.y,
		targetPosition: toPosition
	};
	switch (type) {
		case ConnectionLineType.Bezier:
			[path] = getBezierPath(pathParams);
			break;
		case ConnectionLineType.SimpleBezier:
			[path] = getSimpleBezierPath(pathParams);
			break;
		case ConnectionLineType.Step:
			[path] = getSmoothStepPath({
				...pathParams,
				borderRadius: 0
			});
			break;
		case ConnectionLineType.SmoothStep:
			[path] = getSmoothStepPath(pathParams);
			break;
		default: [path] = getStraightPath(pathParams);
	}
	return jsx("path", {
		d: path,
		fill: "none",
		className: "react-flow__connection-path",
		style
	});
};
ConnectionLine.displayName = "ConnectionLine";
var emptyTypes = {};
function useNodeOrEdgeTypesWarning(nodeOrEdgeTypes = emptyTypes) {
	(0, react.useRef)(nodeOrEdgeTypes);
	useStoreApi();
	(0, react.useEffect)(() => {}, [nodeOrEdgeTypes]);
}
function useStylesLoadedWarning() {
	useStoreApi();
	(0, react.useRef)(false);
	(0, react.useEffect)(() => {}, []);
}
function GraphViewComponent({ nodeTypes, edgeTypes, onInit, onNodeClick, onEdgeClick, onNodeDoubleClick, onEdgeDoubleClick, onNodeMouseEnter, onNodeMouseMove, onNodeMouseLeave, onNodeContextMenu, onSelectionContextMenu, onSelectionStart, onSelectionEnd, connectionLineType, connectionLineStyle, connectionLineComponent, connectionLineContainerStyle, selectionKeyCode, selectionOnDrag, selectionMode, multiSelectionKeyCode, panActivationKeyCode, zoomActivationKeyCode, deleteKeyCode, onlyRenderVisibleElements, elementsSelectable, defaultViewport, translateExtent, minZoom, maxZoom, preventScrolling, defaultMarkerColor, zoomOnScroll, zoomOnPinch, panOnScroll, panOnScrollSpeed, panOnScrollMode, zoomOnDoubleClick, panOnDrag, autoPanOnSelection, onPaneClick, onPaneMouseEnter, onPaneMouseMove, onPaneMouseLeave, onPaneScroll, onPaneContextMenu, paneClickDistance, nodeClickDistance, onEdgeContextMenu, onEdgeMouseEnter, onEdgeMouseMove, onEdgeMouseLeave, reconnectRadius, onReconnect, onReconnectStart, onReconnectEnd, noDragClassName, noWheelClassName, noPanClassName, disableKeyboardA11y, nodeExtent, rfId, viewport, onViewportChange, nodesDraggable }) {
	useNodeOrEdgeTypesWarning(nodeTypes);
	useNodeOrEdgeTypesWarning(edgeTypes);
	useStylesLoadedWarning();
	useOnInitHandler(onInit);
	useViewportSync(viewport);
	return jsx(FlowRenderer, {
		onPaneClick,
		onPaneMouseEnter,
		onPaneMouseMove,
		onPaneMouseLeave,
		onPaneContextMenu,
		onPaneScroll,
		paneClickDistance,
		deleteKeyCode,
		selectionKeyCode,
		selectionOnDrag,
		selectionMode,
		onSelectionStart,
		onSelectionEnd,
		multiSelectionKeyCode,
		panActivationKeyCode,
		zoomActivationKeyCode,
		elementsSelectable,
		zoomOnScroll,
		zoomOnPinch,
		zoomOnDoubleClick,
		panOnScroll,
		panOnScrollSpeed,
		panOnScrollMode,
		panOnDrag,
		autoPanOnSelection,
		defaultViewport,
		translateExtent,
		minZoom,
		maxZoom,
		onSelectionContextMenu,
		preventScrolling,
		noDragClassName,
		noWheelClassName,
		noPanClassName,
		disableKeyboardA11y,
		onViewportChange,
		isControlledViewport: !!viewport,
		children: jsxs(Viewport, { children: [
			jsx(EdgeRenderer, {
				edgeTypes,
				onEdgeClick,
				onEdgeDoubleClick,
				onReconnect,
				onReconnectStart,
				onReconnectEnd,
				onlyRenderVisibleElements,
				onEdgeContextMenu,
				onEdgeMouseEnter,
				onEdgeMouseMove,
				onEdgeMouseLeave,
				reconnectRadius,
				defaultMarkerColor,
				noPanClassName,
				disableKeyboardA11y,
				rfId
			}),
			jsx(ConnectionLineWrapper, {
				style: connectionLineStyle,
				type: connectionLineType,
				component: connectionLineComponent,
				containerStyle: connectionLineContainerStyle
			}),
			jsx("div", { className: "react-flow__edgelabel-renderer" }),
			jsx(NodeRenderer, {
				nodeTypes,
				onNodeClick,
				onNodeDoubleClick,
				onNodeMouseEnter,
				onNodeMouseMove,
				onNodeMouseLeave,
				onNodeContextMenu,
				nodeClickDistance,
				onlyRenderVisibleElements,
				noPanClassName,
				noDragClassName,
				disableKeyboardA11y,
				nodeExtent,
				rfId,
				nodesDraggable
			}),
			jsx("div", { className: "react-flow__viewport-portal" })
		] })
	});
}
GraphViewComponent.displayName = "GraphView";
var GraphView = (0, react.memo)(GraphViewComponent);
var devWarn = createDevWarn("React Flow", "https://reactflow.dev/");
var getInitialState = ({ nodes, edges, defaultNodes, defaultEdges, width, height, fitView, fitViewOptions, minZoom = .5, maxZoom = 2, nodeOrigin, nodeExtent, zIndexMode = "basic" } = {}) => {
	const nodeLookup = /* @__PURE__ */ new Map();
	const parentLookup = /* @__PURE__ */ new Map();
	const connectionLookup = /* @__PURE__ */ new Map();
	const edgeLookup = /* @__PURE__ */ new Map();
	const storeEdges = defaultEdges ?? edges ?? [];
	const storeNodes = defaultNodes ?? nodes ?? [];
	const storeNodeOrigin = nodeOrigin ?? [0, 0];
	const storeNodeExtent = nodeExtent ?? infiniteExtent;
	updateConnectionLookup(connectionLookup, edgeLookup, storeEdges);
	const { nodesInitialized } = adoptUserNodes(storeNodes, nodeLookup, parentLookup, {
		nodeOrigin: storeNodeOrigin,
		nodeExtent: storeNodeExtent,
		zIndexMode
	});
	let transform = [
		0,
		0,
		1
	];
	if (fitView && width && height) {
		const { x, y, zoom } = getViewportForBounds(getInternalNodesBounds(nodeLookup, { filter: (node) => !!((node.width || node.initialWidth) && (node.height || node.initialHeight)) }), width, height, minZoom, maxZoom, fitViewOptions?.padding ?? .1);
		transform = [
			x,
			y,
			zoom
		];
	}
	return {
		rfId: "1",
		width: width ?? 0,
		height: height ?? 0,
		transform,
		nodes: storeNodes,
		nodesInitialized,
		nodeLookup,
		parentLookup,
		edges: storeEdges,
		edgeLookup,
		connectionLookup,
		onNodesChange: null,
		onEdgesChange: null,
		hasDefaultNodes: defaultNodes !== void 0,
		hasDefaultEdges: defaultEdges !== void 0,
		panZoom: null,
		minZoom,
		maxZoom,
		translateExtent: infiniteExtent,
		nodeExtent: storeNodeExtent,
		nodesSelectionActive: false,
		userSelectionActive: false,
		userSelectionRect: null,
		connectionMode: ConnectionMode.Strict,
		domNode: null,
		paneDragging: false,
		noPanClassName: "nopan",
		nodeOrigin: storeNodeOrigin,
		nodeDragThreshold: 1,
		connectionDragThreshold: 1,
		snapGrid: [15, 15],
		snapToGrid: false,
		nodesDraggable: true,
		nodesConnectable: true,
		nodesFocusable: true,
		edgesFocusable: true,
		edgesReconnectable: true,
		elementsSelectable: true,
		elevateNodesOnSelect: true,
		elevateEdgesOnSelect: true,
		selectNodesOnDrag: true,
		multiSelectionActive: false,
		fitViewQueued: fitView ?? false,
		fitViewOptions,
		fitViewResolver: null,
		connection: { ...initialConnection },
		connectionClickStartHandle: null,
		connectOnClick: true,
		ariaLiveMessage: "",
		autoPanOnConnect: true,
		autoPanOnNodeDrag: true,
		autoPanOnNodeFocus: true,
		autoPanSpeed: 15,
		connectionRadius: 20,
		onError: devWarn,
		isValidConnection: void 0,
		onSelectionChangeHandlers: [],
		lib: "react",
		debug: false,
		ariaLabelConfig: defaultAriaLabelConfig,
		zIndexMode,
		defaultEdgeOptions: void 0,
		onNodesChangeMiddlewareMap: /* @__PURE__ */ new Map(),
		onEdgesChangeMiddlewareMap: /* @__PURE__ */ new Map(),
		onNodesDelete: void 0,
		onEdgesDelete: void 0,
		onDelete: void 0,
		onBeforeDelete: void 0,
		onViewportChangeStart: void 0,
		onViewportChange: void 0,
		onViewportChangeEnd: void 0,
		onNodeDragStart: void 0,
		onNodeDrag: void 0,
		onNodeDragStop: void 0,
		onSelectionDragStart: void 0,
		onSelectionDrag: void 0,
		onSelectionDragStop: void 0,
		onMoveStart: void 0,
		onMove: void 0,
		onMoveEnd: void 0,
		onConnect: void 0,
		onConnectStart: void 0,
		onConnectEnd: void 0,
		onClickConnectStart: void 0,
		onClickConnectEnd: void 0
	};
};
var createStore = ({ nodes, edges, defaultNodes, defaultEdges, width, height, fitView, fitViewOptions, minZoom, maxZoom, nodeOrigin, nodeExtent, zIndexMode }) => createWithEqualityFn((set, get) => {
	async function resolveFitView() {
		const { nodeLookup, panZoom, fitViewOptions, fitViewResolver, width, height, minZoom, maxZoom } = get();
		if (!panZoom) return;
		await fitViewport({
			nodes: nodeLookup,
			width,
			height,
			panZoom,
			minZoom,
			maxZoom
		}, fitViewOptions);
		fitViewResolver?.resolve(true);
		/**
		* wait for the fitViewport to resolve before deleting the resolver,
		* we want to reuse the old resolver if the user calls fitView again in the mean time
		*/
		set({ fitViewResolver: null });
	}
	return {
		...getInitialState({
			nodes,
			edges,
			width,
			height,
			fitView,
			fitViewOptions,
			minZoom,
			maxZoom,
			nodeOrigin,
			nodeExtent,
			defaultNodes,
			defaultEdges,
			zIndexMode
		}),
		setNodes: (nodes) => {
			const { nodeLookup, parentLookup, nodeOrigin, nodeExtent, elevateNodesOnSelect, fitViewQueued, zIndexMode, nodesSelectionActive } = get();
			const { nodesInitialized, hasSelectedNodes } = adoptUserNodes(nodes, nodeLookup, parentLookup, {
				nodeOrigin,
				nodeExtent,
				elevateNodesOnSelect,
				checkEquality: true,
				zIndexMode
			});
			const nextNodesSelectionActive = nodesSelectionActive && hasSelectedNodes;
			if (fitViewQueued && nodesInitialized) {
				resolveFitView();
				set({
					nodes,
					nodesInitialized,
					fitViewQueued: false,
					fitViewOptions: void 0,
					nodesSelectionActive: nextNodesSelectionActive
				});
			} else set({
				nodes,
				nodesInitialized,
				nodesSelectionActive: nextNodesSelectionActive
			});
		},
		setEdges: (edges) => {
			const { connectionLookup, edgeLookup } = get();
			updateConnectionLookup(connectionLookup, edgeLookup, edges);
			set({ edges });
		},
		setDefaultNodesAndEdges: (nodes, edges) => {
			if (nodes) {
				const { setNodes } = get();
				setNodes(nodes);
				set({ hasDefaultNodes: true });
			}
			if (edges) {
				const { setEdges } = get();
				setEdges(edges);
				set({ hasDefaultEdges: true });
			}
		},
		updateNodeInternals: (updates) => {
			const { triggerNodeChanges, nodeLookup, parentLookup, domNode, nodeOrigin, nodeExtent, debug, fitViewQueued, zIndexMode } = get();
			const { changes, updatedInternals } = updateNodeInternals(updates, nodeLookup, parentLookup, domNode, nodeOrigin, nodeExtent, zIndexMode);
			if (!updatedInternals) return;
			updateAbsolutePositions(nodeLookup, parentLookup, {
				nodeOrigin,
				nodeExtent,
				zIndexMode
			});
			if (fitViewQueued) {
				resolveFitView();
				set({
					fitViewQueued: false,
					fitViewOptions: void 0
				});
			} else set({});
			if (changes?.length > 0) {
				if (debug) console.log("React Flow: trigger node changes", changes);
				triggerNodeChanges?.(changes);
			}
		},
		updateNodePositions: (nodeDragItems, dragging = false) => {
			const parentExpandChildren = [];
			let changes = [];
			const { nodeLookup, triggerNodeChanges, connection, updateConnection, onNodesChangeMiddlewareMap } = get();
			for (const [id, dragItem] of nodeDragItems) {
				const node = nodeLookup.get(id);
				const expandParent = !!(node?.expandParent && node?.parentId && dragItem?.position);
				const change = {
					id,
					type: "position",
					position: expandParent ? {
						x: Math.max(0, dragItem.position.x),
						y: Math.max(0, dragItem.position.y)
					} : dragItem.position,
					dragging
				};
				if (node && connection.inProgress && connection.fromNode.id === node.id) {
					const updatedFrom = getHandlePosition(node, connection.fromHandle, Position.Left, true);
					updateConnection({
						...connection,
						from: updatedFrom
					});
				}
				if (expandParent && node.parentId) parentExpandChildren.push({
					id,
					parentId: node.parentId,
					rect: {
						...dragItem.internals.positionAbsolute,
						width: dragItem.measured.width ?? 0,
						height: dragItem.measured.height ?? 0
					}
				});
				changes.push(change);
			}
			if (parentExpandChildren.length > 0) {
				const { parentLookup, nodeOrigin } = get();
				const parentExpandChanges = handleExpandParent(parentExpandChildren, nodeLookup, parentLookup, nodeOrigin);
				changes.push(...parentExpandChanges);
			}
			for (const middleware of onNodesChangeMiddlewareMap.values()) changes = middleware(changes);
			triggerNodeChanges(changes);
		},
		triggerNodeChanges: (changes) => {
			const { onNodesChange, setNodes, nodes, hasDefaultNodes, debug } = get();
			if (changes?.length) {
				if (hasDefaultNodes) setNodes(applyNodeChanges(changes, nodes));
				if (debug) console.log("React Flow: trigger node changes", changes);
				onNodesChange?.(changes);
			}
		},
		triggerEdgeChanges: (changes) => {
			const { onEdgesChange, setEdges, edges, hasDefaultEdges, debug } = get();
			if (changes?.length) {
				if (hasDefaultEdges) setEdges(applyEdgeChanges(changes, edges));
				if (debug) console.log("React Flow: trigger edge changes", changes);
				onEdgesChange?.(changes);
			}
		},
		addSelectedNodes: (selectedNodeIds) => {
			const { multiSelectionActive, edgeLookup, nodeLookup, triggerNodeChanges, triggerEdgeChanges } = get();
			if (multiSelectionActive) {
				triggerNodeChanges(selectedNodeIds.map((nodeId) => createSelectionChange(nodeId, true)));
				return;
			}
			triggerNodeChanges(getSelectionChanges(nodeLookup, /* @__PURE__ */ new Set([...selectedNodeIds]), true));
			triggerEdgeChanges(getSelectionChanges(edgeLookup));
		},
		addSelectedEdges: (selectedEdgeIds) => {
			const { multiSelectionActive, edgeLookup, nodeLookup, triggerNodeChanges, triggerEdgeChanges } = get();
			if (multiSelectionActive) {
				triggerEdgeChanges(selectedEdgeIds.map((edgeId) => createSelectionChange(edgeId, true)));
				return;
			}
			triggerEdgeChanges(getSelectionChanges(edgeLookup, /* @__PURE__ */ new Set([...selectedEdgeIds])));
			triggerNodeChanges(getSelectionChanges(nodeLookup, /* @__PURE__ */ new Set(), true));
		},
		unselectNodesAndEdges: ({ nodes, edges } = {}) => {
			const { edges: storeEdges, nodes: storeNodes, nodeLookup, triggerNodeChanges, triggerEdgeChanges } = get();
			const nodesToUnselect = nodes ? nodes : storeNodes;
			const edgesToUnselect = edges ? edges : storeEdges;
			const nodeChanges = [];
			for (const node of nodesToUnselect) {
				if (!node.selected) continue;
				const internalNode = nodeLookup.get(node.id);
				if (internalNode) internalNode.selected = false;
				nodeChanges.push(createSelectionChange(node.id, false));
			}
			const edgeChanges = [];
			for (const edge of edgesToUnselect) {
				if (!edge.selected) continue;
				edgeChanges.push(createSelectionChange(edge.id, false));
			}
			triggerNodeChanges(nodeChanges);
			triggerEdgeChanges(edgeChanges);
		},
		setMinZoom: (minZoom) => {
			const { panZoom, maxZoom } = get();
			panZoom?.setScaleExtent([minZoom, maxZoom]);
			set({ minZoom });
		},
		setMaxZoom: (maxZoom) => {
			const { panZoom, minZoom } = get();
			panZoom?.setScaleExtent([minZoom, maxZoom]);
			set({ maxZoom });
		},
		setTranslateExtent: (translateExtent) => {
			get().panZoom?.setTranslateExtent(translateExtent);
			set({ translateExtent });
		},
		resetSelectedElements: () => {
			const { edges, nodes, triggerNodeChanges, triggerEdgeChanges, elementsSelectable } = get();
			if (!elementsSelectable) return;
			const nodeChanges = nodes.reduce((res, node) => node.selected ? [...res, createSelectionChange(node.id, false)] : res, []);
			const edgeChanges = edges.reduce((res, edge) => edge.selected ? [...res, createSelectionChange(edge.id, false)] : res, []);
			triggerNodeChanges(nodeChanges);
			triggerEdgeChanges(edgeChanges);
		},
		setNodeExtent: (nextNodeExtent) => {
			const { nodes, nodeLookup, parentLookup, nodeOrigin, elevateNodesOnSelect, nodeExtent, zIndexMode } = get();
			if (nextNodeExtent[0][0] === nodeExtent[0][0] && nextNodeExtent[0][1] === nodeExtent[0][1] && nextNodeExtent[1][0] === nodeExtent[1][0] && nextNodeExtent[1][1] === nodeExtent[1][1]) return;
			adoptUserNodes(nodes, nodeLookup, parentLookup, {
				nodeOrigin,
				nodeExtent: nextNodeExtent,
				elevateNodesOnSelect,
				checkEquality: false,
				zIndexMode
			});
			set({ nodeExtent: nextNodeExtent });
		},
		panBy: (delta) => {
			const { transform, width, height, panZoom, translateExtent } = get();
			return panBy({
				delta,
				panZoom,
				transform,
				translateExtent,
				width,
				height
			});
		},
		setCenter: async (x, y, options) => {
			const { width, height, maxZoom, panZoom } = get();
			if (!panZoom) return false;
			const nextZoom = typeof options?.zoom !== "undefined" ? options.zoom : maxZoom;
			await panZoom.setViewport({
				x: width / 2 - x * nextZoom,
				y: height / 2 - y * nextZoom,
				zoom: nextZoom
			}, {
				duration: options?.duration,
				ease: options?.ease,
				interpolate: options?.interpolate
			});
			return true;
		},
		cancelConnection: () => {
			set({ connection: { ...initialConnection } });
		},
		updateConnection: (connection) => {
			set({ connection });
		},
		reset: () => set({ ...getInitialState() })
	};
}, Object.is);
/**
* The `<ReactFlowProvider />` component is a [context provider](https://react.dev/learn/passing-data-deeply-with-context#)
* that makes it possible to access a flow's internal state outside of the
* [`<ReactFlow />`](/api-reference/react-flow) component. Many of the hooks we
* provide rely on this component to work.
* @public
*
* @example
* ```tsx
*import { ReactFlow, ReactFlowProvider, useNodes } from '@xyflow/react'
*
*export default function Flow() {
*  return (
*    <ReactFlowProvider>
*      <ReactFlow nodes={...} edges={...} />
*      <Sidebar />
*    </ReactFlowProvider>
*  );
*}
*
*function Sidebar() {
*  // This hook will only work if the component it's used in is a child of a
*  // <ReactFlowProvider />.
*  const nodes = useNodes()
*
*  return <aside>do something with nodes</aside>;
*}
*```
*
* @remarks If you're using a router and want your flow's state to persist across routes,
* it's vital that you place the `<ReactFlowProvider />` component _outside_ of
* your router. If you have multiple flows on the same page you will need to use a separate
* `<ReactFlowProvider />` for each flow.
*/
function ReactFlowProvider({ initialNodes: nodes, initialEdges: edges, defaultNodes, defaultEdges, initialWidth: width, initialHeight: height, initialMinZoom: minZoom, initialMaxZoom: maxZoom, initialFitViewOptions: fitViewOptions, fitView, nodeOrigin, nodeExtent, zIndexMode, children }) {
	const [store] = (0, react.useState)(() => createStore({
		nodes,
		edges,
		defaultNodes,
		defaultEdges,
		width,
		height,
		fitView,
		minZoom,
		maxZoom,
		fitViewOptions,
		nodeOrigin,
		nodeExtent,
		zIndexMode
	}));
	return jsx(Provider$1, {
		value: store,
		children: jsx(BatchProvider, { children: jsx(HandleConfigProvider, { children }) })
	});
}
function Wrapper({ children, nodes, edges, defaultNodes, defaultEdges, width, height, fitView, fitViewOptions, minZoom, maxZoom, nodeOrigin, nodeExtent, zIndexMode }) {
	if ((0, react.useContext)(StoreContext)) return jsx(Fragment, { children });
	return jsx(ReactFlowProvider, {
		initialNodes: nodes,
		initialEdges: edges,
		defaultNodes,
		defaultEdges,
		initialWidth: width,
		initialHeight: height,
		fitView,
		initialFitViewOptions: fitViewOptions,
		initialMinZoom: minZoom,
		initialMaxZoom: maxZoom,
		nodeOrigin,
		nodeExtent,
		zIndexMode,
		children
	});
}
var wrapperStyle = {
	width: "100%",
	height: "100%",
	overflow: "hidden",
	position: "relative",
	zIndex: 0
};
function ReactFlow({ nodes, edges, defaultNodes, defaultEdges, className, nodeTypes, edgeTypes, onNodeClick, onEdgeClick, onInit, onMove, onMoveStart, onMoveEnd, onConnect, onConnectStart, onConnectEnd, onClickConnectStart, onClickConnectEnd, onNodeMouseEnter, onNodeMouseMove, onNodeMouseLeave, onNodeContextMenu, onNodeDoubleClick, onNodeDragStart, onNodeDrag, onNodeDragStop, onNodesDelete, onEdgesDelete, onDelete, onSelectionChange, onSelectionDragStart, onSelectionDrag, onSelectionDragStop, onSelectionContextMenu, onSelectionStart, onSelectionEnd, onBeforeDelete, connectionMode, connectionLineType = ConnectionLineType.Bezier, connectionLineStyle, connectionLineComponent, connectionLineContainerStyle, deleteKeyCode = "Backspace", selectionKeyCode = "Shift", selectionOnDrag = false, selectionMode = SelectionMode.Full, panActivationKeyCode = "Space", multiSelectionKeyCode = isMacOs() ? "Meta" : "Control", zoomActivationKeyCode = isMacOs() ? "Meta" : "Control", snapToGrid, snapGrid, onlyRenderVisibleElements = false, selectNodesOnDrag, nodesDraggable, autoPanOnNodeFocus, nodesConnectable, nodesFocusable, nodeOrigin = defaultNodeOrigin, edgesFocusable, edgesReconnectable, elementsSelectable = true, defaultViewport: defaultViewport$1 = defaultViewport, minZoom = .5, maxZoom = 2, translateExtent = infiniteExtent, preventScrolling = true, nodeExtent, defaultMarkerColor = "#b1b1b7", zoomOnScroll = true, zoomOnPinch = true, panOnScroll = false, panOnScrollSpeed = .5, panOnScrollMode = PanOnScrollMode.Free, zoomOnDoubleClick = true, panOnDrag = true, onPaneClick, onPaneMouseEnter, onPaneMouseMove, onPaneMouseLeave, onPaneScroll, onPaneContextMenu, paneClickDistance = 1, nodeClickDistance = 0, children, onReconnect, onReconnectStart, onReconnectEnd, onEdgeContextMenu, onEdgeDoubleClick, onEdgeMouseEnter, onEdgeMouseMove, onEdgeMouseLeave, reconnectRadius = 10, onNodesChange, onEdgesChange, noDragClassName = "nodrag", noWheelClassName = "nowheel", noPanClassName = "nopan", fitView, fitViewOptions, connectOnClick, attributionPosition, proOptions, defaultEdgeOptions, elevateNodesOnSelect = true, elevateEdgesOnSelect = false, disableKeyboardA11y = false, autoPanOnConnect, autoPanOnNodeDrag, autoPanOnSelection = true, autoPanSpeed, connectionRadius, isValidConnection, onError, style, id, nodeDragThreshold, connectionDragThreshold, viewport, onViewportChange, width, height, colorMode = "light", debug, onScroll, ariaLabelConfig, zIndexMode = "basic", ...rest }, ref) {
	const rfId = id || "1";
	const colorModeClassName = useColorModeClass(colorMode);
	const wrapperOnScroll = (0, react.useCallback)((e) => {
		e.currentTarget.scrollTo({
			top: 0,
			left: 0,
			behavior: "instant"
		});
		onScroll?.(e);
	}, [onScroll]);
	return jsx("div", {
		"data-testid": "rf__wrapper",
		...rest,
		onScroll: wrapperOnScroll,
		style: {
			...style,
			...wrapperStyle
		},
		ref,
		className: cc([
			"react-flow",
			className,
			colorModeClassName
		]),
		id,
		role: "application",
		children: jsxs(Wrapper, {
			nodes,
			edges,
			width,
			height,
			fitView,
			fitViewOptions,
			minZoom,
			maxZoom,
			nodeOrigin,
			nodeExtent,
			zIndexMode,
			children: [
				jsx(StoreUpdater, {
					nodes,
					edges,
					defaultNodes,
					defaultEdges,
					onConnect,
					onConnectStart,
					onConnectEnd,
					onClickConnectStart,
					onClickConnectEnd,
					nodesDraggable,
					autoPanOnNodeFocus,
					nodesConnectable,
					nodesFocusable,
					edgesFocusable,
					edgesReconnectable,
					elementsSelectable,
					elevateNodesOnSelect,
					elevateEdgesOnSelect,
					minZoom,
					maxZoom,
					nodeExtent,
					onNodesChange,
					onEdgesChange,
					snapToGrid,
					snapGrid,
					connectionMode,
					translateExtent,
					connectOnClick,
					defaultEdgeOptions,
					fitView,
					fitViewOptions,
					onNodesDelete,
					onEdgesDelete,
					onDelete,
					onNodeDragStart,
					onNodeDrag,
					onNodeDragStop,
					onSelectionDrag,
					onSelectionDragStart,
					onSelectionDragStop,
					onMove,
					onMoveStart,
					onMoveEnd,
					noPanClassName,
					nodeOrigin,
					rfId,
					autoPanOnConnect,
					autoPanOnNodeDrag,
					autoPanSpeed,
					onError,
					connectionRadius,
					isValidConnection,
					selectNodesOnDrag,
					nodeDragThreshold,
					connectionDragThreshold,
					onBeforeDelete,
					debug,
					ariaLabelConfig,
					zIndexMode
				}),
				jsx(GraphView, {
					onInit,
					onNodeClick,
					onEdgeClick,
					onNodeMouseEnter,
					onNodeMouseMove,
					onNodeMouseLeave,
					onNodeContextMenu,
					onNodeDoubleClick,
					nodeTypes,
					edgeTypes,
					connectionLineType,
					connectionLineStyle,
					connectionLineComponent,
					connectionLineContainerStyle,
					selectionKeyCode,
					selectionOnDrag,
					selectionMode,
					deleteKeyCode,
					multiSelectionKeyCode,
					panActivationKeyCode,
					zoomActivationKeyCode,
					onlyRenderVisibleElements,
					defaultViewport: defaultViewport$1,
					translateExtent,
					minZoom,
					maxZoom,
					preventScrolling,
					zoomOnScroll,
					zoomOnPinch,
					zoomOnDoubleClick,
					panOnScroll,
					panOnScrollSpeed,
					panOnScrollMode,
					panOnDrag,
					autoPanOnSelection,
					onPaneClick,
					onPaneMouseEnter,
					onPaneMouseMove,
					onPaneMouseLeave,
					onPaneScroll,
					onPaneContextMenu,
					paneClickDistance,
					nodeClickDistance,
					onSelectionContextMenu,
					onSelectionStart,
					onSelectionEnd,
					onReconnect,
					onReconnectStart,
					onReconnectEnd,
					onEdgeContextMenu,
					onEdgeDoubleClick,
					onEdgeMouseEnter,
					onEdgeMouseMove,
					onEdgeMouseLeave,
					reconnectRadius,
					defaultMarkerColor,
					noDragClassName,
					noWheelClassName,
					noPanClassName,
					rfId,
					disableKeyboardA11y,
					nodeExtent,
					viewport,
					onViewportChange,
					nodesDraggable
				}),
				jsx(SelectionListener, { onSelectionChange }),
				children,
				jsx(Attribution, {
					proOptions,
					position: attributionPosition
				}),
				jsx(A11yDescriptions, {
					rfId,
					disableKeyboardA11y
				})
			]
		})
	});
}
/**
* The `<ReactFlow />` component is the heart of your React Flow application.
* It renders your nodes and edges and handles user interaction
*
* @public
*
* @example
* ```tsx
*import { ReactFlow } from '@xyflow/react'
*
*export default function Flow() {
*  return (<ReactFlow
*    nodes={...}
*    edges={...}
*    onNodesChange={...}
*    ...
*  />);
*}
*```
*/
var index = fixedForwardRef(ReactFlow);
/**
* This hook makes it easy to prototype a controlled flow where you manage the
* state of nodes and edges outside the `ReactFlowInstance`. You can think of it
* like React's `useState` hook with an additional helper callback.
*
* @public
* @returns
* - `nodes`: The current array of nodes. You might pass this directly to the `nodes` prop of your
* `<ReactFlow />` component, or you may want to manipulate it first to perform some layouting,
* for example.
* - `setNodes`: A function that you can use to update the nodes. You can pass it a new array of
* nodes or a callback that receives the current array of nodes and returns a new array of nodes.
* This is the same as the second element of the tuple returned by React's `useState` hook.
* - `onNodesChange`: A handy callback that can take an array of `NodeChanges` and update the nodes
* state accordingly. You'll typically pass this directly to the `onNodesChange` prop of your
* `<ReactFlow />` component.
* @example
*
*```tsx
*import { ReactFlow, useNodesState, useEdgesState } from '@xyflow/react';
*
*const initialNodes = [];
*const initialEdges = [];
*
*export default function () {
*  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
*  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
*
*  return (
*    <ReactFlow
*      nodes={nodes}
*      edges={edges}
*      onNodesChange={onNodesChange}
*      onEdgesChange={onEdgesChange}
*    />
*  );
*}
*```
*
* @remarks This hook was created to make prototyping easier and our documentation
* examples clearer. Although it is OK to use this hook in production, in
* practice you may want to use a more sophisticated state management solution
* like Zustand {@link https://reactflow.dev/docs/guides/state-management/} instead.
*
*/
function useNodesState(initialNodes) {
	const [nodes, setNodes] = (0, react.useState)(initialNodes);
	return [
		nodes,
		setNodes,
		(0, react.useCallback)((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), [])
	];
}
/**
* This hook makes it easy to prototype a controlled flow where you manage the
* state of nodes and edges outside the `ReactFlowInstance`. You can think of it
* like React's `useState` hook with an additional helper callback.
*
* @public
* @returns
* - `edges`: The current array of edges. You might pass this directly to the `edges` prop of your
* `<ReactFlow />` component, or you may want to manipulate it first to perform some layouting,
* for example.
*
* - `setEdges`: A function that you can use to update the edges. You can pass it a new array of
* edges or a callback that receives the current array of edges and returns a new array of edges.
* This is the same as the second element of the tuple returned by React's `useState` hook.
*
* - `onEdgesChange`: A handy callback that can take an array of `EdgeChanges` and update the edges
* state accordingly. You'll typically pass this directly to the `onEdgesChange` prop of your
* `<ReactFlow />` component.
* @example
*
*```tsx
*import { ReactFlow, useNodesState, useEdgesState } from '@xyflow/react';
*
*const initialNodes = [];
*const initialEdges = [];
*
*export default function () {
*  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
*  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
*
*  return (
*    <ReactFlow
*      nodes={nodes}
*      edges={edges}
*      onNodesChange={onNodesChange}
*      onEdgesChange={onEdgesChange}
*    />
*  );
*}
*```
*
* @remarks This hook was created to make prototyping easier and our documentation
* examples clearer. Although it is OK to use this hook in production, in
* practice you may want to use a more sophisticated state management solution
* like Zustand {@link https://reactflow.dev/docs/guides/state-management/} instead.
*
*/
function useEdgesState(initialEdges) {
	const [edges, setEdges] = (0, react.useState)(initialEdges);
	return [
		edges,
		setEdges,
		(0, react.useCallback)((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), [])
	];
}
errorMessages["error014"]();
function LinePattern({ dimensions, lineWidth, variant, className }) {
	return jsx("path", {
		strokeWidth: lineWidth,
		d: `M${dimensions[0] / 2} 0 V${dimensions[1]} M0 ${dimensions[1] / 2} H${dimensions[0]}`,
		className: cc([
			"react-flow__background-pattern",
			variant,
			className
		])
	});
}
function DotPattern({ radius, className }) {
	return jsx("circle", {
		cx: radius,
		cy: radius,
		r: radius,
		className: cc([
			"react-flow__background-pattern",
			"dots",
			className
		])
	});
}
/**
* The three variants are exported as an enum for convenience. You can either import
* the enum and use it like `BackgroundVariant.Lines` or you can use the raw string
* value directly.
* @public
*/
var BackgroundVariant;
(function(BackgroundVariant) {
	BackgroundVariant["Lines"] = "lines";
	BackgroundVariant["Dots"] = "dots";
	BackgroundVariant["Cross"] = "cross";
})(BackgroundVariant || (BackgroundVariant = {}));
var defaultSize = {
	[BackgroundVariant.Dots]: 1,
	[BackgroundVariant.Lines]: 1,
	[BackgroundVariant.Cross]: 6
};
var selector$3 = (s) => ({
	transform: s.transform,
	patternId: `pattern-${s.rfId}`
});
function BackgroundComponent({ id, variant = BackgroundVariant.Dots, gap = 20, size, lineWidth = 1, offset = 0, color, bgColor, style, className, patternClassName }) {
	const ref = (0, react.useRef)(null);
	const { transform, patternId } = useStore(selector$3, shallow$1);
	const patternSize = size || defaultSize[variant];
	const isDots = variant === BackgroundVariant.Dots;
	const isCross = variant === BackgroundVariant.Cross;
	const gapXY = Array.isArray(gap) ? gap : [gap, gap];
	const scaledGap = [gapXY[0] * transform[2] || 1, gapXY[1] * transform[2] || 1];
	const scaledSize = patternSize * transform[2];
	const offsetXY = Array.isArray(offset) ? offset : [offset, offset];
	const patternDimensions = isCross ? [scaledSize, scaledSize] : scaledGap;
	const scaledOffset = [offsetXY[0] * transform[2] + patternDimensions[0] / 2, offsetXY[1] * transform[2] + patternDimensions[1] / 2];
	const _patternId = `${patternId}${id ? id : ""}`;
	return jsxs("svg", {
		className: cc(["react-flow__background", className]),
		style: {
			...style,
			...containerStyle,
			"--xy-background-color-props": bgColor,
			"--xy-background-pattern-color-props": color
		},
		ref,
		"data-testid": "rf__background",
		children: [jsx("pattern", {
			id: _patternId,
			x: transform[0] % scaledGap[0],
			y: transform[1] % scaledGap[1],
			width: scaledGap[0],
			height: scaledGap[1],
			patternUnits: "userSpaceOnUse",
			patternTransform: `translate(-${scaledOffset[0]},-${scaledOffset[1]})`,
			children: isDots ? jsx(DotPattern, {
				radius: scaledSize / 2,
				className: patternClassName
			}) : jsx(LinePattern, {
				dimensions: patternDimensions,
				lineWidth,
				variant,
				className: patternClassName
			})
		}), jsx("rect", {
			x: "0",
			y: "0",
			width: "100%",
			height: "100%",
			fill: `url(#${_patternId})`
		})]
	});
}
BackgroundComponent.displayName = "Background";
/**
* The `<Background />` component makes it convenient to render different types of backgrounds common in node-based UIs. It comes with three variants: lines, dots and cross.
*
* @example
*
* A simple example of how to use the Background component.
*
* ```tsx
* import { useState } from 'react';
* import { ReactFlow, Background, BackgroundVariant } from '@xyflow/react';
*
* export default function Flow() {
*   return (
*     <ReactFlow defaultNodes={[...]} defaultEdges={[...]}>
*       <Background color="#ccc" variant={BackgroundVariant.Dots} />
*     </ReactFlow>
*   );
* }
* ```
*
* @example
*
* In this example you can see how to combine multiple backgrounds
*
* ```tsx
* import { ReactFlow, Background, BackgroundVariant } from '@xyflow/react';
* import '@xyflow/react/dist/style.css';
*
* export default function Flow() {
*   return (
*     <ReactFlow defaultNodes={[...]} defaultEdges={[...]}>
*       <Background
*         id="1"
*         gap={10}
*         color="#f1f1f1"
*         variant={BackgroundVariant.Lines}
*       />
*       <Background
*         id="2"
*         gap={100}
*         color="#ccc"
*         variant={BackgroundVariant.Lines}
*       />
*     </ReactFlow>
*   );
* }
* ```
*
* @remarks
*
* When combining multiple <Background /> components it’s important to give each of them a unique id prop!
*
*/
var Background = (0, react.memo)(BackgroundComponent);
function PlusIcon() {
	return jsx("svg", {
		xmlns: "http://www.w3.org/2000/svg",
		viewBox: "0 0 32 32",
		children: jsx("path", { d: "M32 18.133H18.133V32h-4.266V18.133H0v-4.266h13.867V0h4.266v13.867H32z" })
	});
}
function MinusIcon() {
	return jsx("svg", {
		xmlns: "http://www.w3.org/2000/svg",
		viewBox: "0 0 32 5",
		children: jsx("path", { d: "M0 0h32v4.2H0z" })
	});
}
function FitViewIcon() {
	return jsx("svg", {
		xmlns: "http://www.w3.org/2000/svg",
		viewBox: "0 0 32 30",
		children: jsx("path", { d: "M3.692 4.63c0-.53.4-.938.939-.938h5.215V0H4.708C2.13 0 0 2.054 0 4.63v5.216h3.692V4.631zM27.354 0h-5.2v3.692h5.17c.53 0 .984.4.984.939v5.215H32V4.631A4.624 4.624 0 0027.354 0zm.954 24.83c0 .532-.4.94-.939.94h-5.215v3.768h5.215c2.577 0 4.631-2.13 4.631-4.707v-5.139h-3.692v5.139zm-23.677.94c-.531 0-.939-.4-.939-.94v-5.138H0v5.139c0 2.577 2.13 4.707 4.708 4.707h5.138V25.77H4.631z" })
	});
}
function LockIcon() {
	return jsx("svg", {
		xmlns: "http://www.w3.org/2000/svg",
		viewBox: "0 0 25 32",
		children: jsx("path", { d: "M21.333 10.667H19.81V7.619C19.81 3.429 16.38 0 12.19 0 8 0 4.571 3.429 4.571 7.619v3.048H3.048A3.056 3.056 0 000 13.714v15.238A3.056 3.056 0 003.048 32h18.285a3.056 3.056 0 003.048-3.048V13.714a3.056 3.056 0 00-3.048-3.047zM12.19 24.533a3.056 3.056 0 01-3.047-3.047 3.056 3.056 0 013.047-3.048 3.056 3.056 0 013.048 3.048 3.056 3.056 0 01-3.048 3.047zm4.724-13.866H7.467V7.619c0-2.59 2.133-4.724 4.723-4.724 2.591 0 4.724 2.133 4.724 4.724v3.048z" })
	});
}
function UnlockIcon() {
	return jsx("svg", {
		xmlns: "http://www.w3.org/2000/svg",
		viewBox: "0 0 25 32",
		children: jsx("path", { d: "M21.333 10.667H19.81V7.619C19.81 3.429 16.38 0 12.19 0c-4.114 1.828-1.37 2.133.305 2.438 1.676.305 4.42 2.59 4.42 5.181v3.048H3.047A3.056 3.056 0 000 13.714v15.238A3.056 3.056 0 003.048 32h18.285a3.056 3.056 0 003.048-3.048V13.714a3.056 3.056 0 00-3.048-3.047zM12.19 24.533a3.056 3.056 0 01-3.047-3.047 3.056 3.056 0 013.047-3.048 3.056 3.056 0 013.048 3.048 3.056 3.056 0 01-3.048 3.047z" })
	});
}
/**
* You can add buttons to the control panel by using the `<ControlButton />` component
* and pass it as a child to the [`<Controls />`](/api-reference/components/controls) component.
*
* @public
* @example
*```jsx
*import { MagicWand } from '@radix-ui/react-icons'
*import { ReactFlow, Controls, ControlButton } from '@xyflow/react'
*
*export default function Flow() {
*  return (
*    <ReactFlow nodes={[...]} edges={[...]}>
*      <Controls>
*        <ControlButton onClick={() => alert('Something magical just happened. ✨')}>
*          <MagicWand />
*        </ControlButton>
*      </Controls>
*    </ReactFlow>
*  )
*}
*```
*/
function ControlButton({ children, className, ...rest }) {
	return jsx("button", {
		type: "button",
		className: cc(["react-flow__controls-button", className]),
		...rest,
		children
	});
}
var selector$2 = (s) => ({
	isInteractive: s.nodesDraggable || s.nodesConnectable || s.elementsSelectable,
	minZoomReached: s.transform[2] <= s.minZoom,
	maxZoomReached: s.transform[2] >= s.maxZoom,
	ariaLabelConfig: s.ariaLabelConfig
});
function ControlsComponent({ style, showZoom = true, showFitView = true, showInteractive = true, fitViewOptions, onZoomIn, onZoomOut, onFitView, onInteractiveChange, className, children, position = "bottom-left", orientation = "vertical", "aria-label": ariaLabel }) {
	const store = useStoreApi();
	const { isInteractive, minZoomReached, maxZoomReached, ariaLabelConfig } = useStore(selector$2, shallow$1);
	const { zoomIn, zoomOut, fitView } = useReactFlow();
	const onZoomInHandler = () => {
		zoomIn();
		onZoomIn?.();
	};
	const onZoomOutHandler = () => {
		zoomOut();
		onZoomOut?.();
	};
	const onFitViewHandler = () => {
		fitView(fitViewOptions);
		onFitView?.();
	};
	const onToggleInteractivity = () => {
		store.setState({
			nodesDraggable: !isInteractive,
			nodesConnectable: !isInteractive,
			elementsSelectable: !isInteractive
		});
		onInteractiveChange?.(!isInteractive);
	};
	return jsxs(Panel, {
		className: cc([
			"react-flow__controls",
			orientation === "horizontal" ? "horizontal" : "vertical",
			className
		]),
		position,
		style,
		"data-testid": "rf__controls",
		"aria-label": ariaLabel ?? ariaLabelConfig["controls.ariaLabel"],
		children: [
			showZoom && jsxs(Fragment, { children: [jsx(ControlButton, {
				onClick: onZoomInHandler,
				className: "react-flow__controls-zoomin",
				title: ariaLabelConfig["controls.zoomIn.ariaLabel"],
				"aria-label": ariaLabelConfig["controls.zoomIn.ariaLabel"],
				disabled: maxZoomReached,
				children: jsx(PlusIcon, {})
			}), jsx(ControlButton, {
				onClick: onZoomOutHandler,
				className: "react-flow__controls-zoomout",
				title: ariaLabelConfig["controls.zoomOut.ariaLabel"],
				"aria-label": ariaLabelConfig["controls.zoomOut.ariaLabel"],
				disabled: minZoomReached,
				children: jsx(MinusIcon, {})
			})] }),
			showFitView && jsx(ControlButton, {
				className: "react-flow__controls-fitview",
				onClick: onFitViewHandler,
				title: ariaLabelConfig["controls.fitView.ariaLabel"],
				"aria-label": ariaLabelConfig["controls.fitView.ariaLabel"],
				children: jsx(FitViewIcon, {})
			}),
			showInteractive && jsx(ControlButton, {
				className: "react-flow__controls-interactive",
				onClick: onToggleInteractivity,
				title: ariaLabelConfig["controls.interactive.ariaLabel"],
				"aria-label": ariaLabelConfig["controls.interactive.ariaLabel"],
				children: isInteractive ? jsx(UnlockIcon, {}) : jsx(LockIcon, {})
			}),
			children
		]
	});
}
ControlsComponent.displayName = "Controls";
/**
* The `<Controls />` component renders a small panel that contains convenient
* buttons to zoom in, zoom out, fit the view, and lock the viewport.
*
* @public
* @example
*```tsx
*import { ReactFlow, Controls } from '@xyflow/react'
*
*export default function Flow() {
*  return (
*    <ReactFlow nodes={[...]} edges={[...]}>
*      <Controls />
*    </ReactFlow>
*  )
*}
*```
*
* @remarks To extend or customise the controls, you can use the [`<ControlButton />`](/api-reference/components/control-button) component
*
*/
var Controls = (0, react.memo)(ControlsComponent);
function MiniMapNodeComponent({ id, x, y, width, height, style, color, strokeColor, strokeWidth, className, borderRadius, shapeRendering, selected, onClick }) {
	const { background, backgroundColor } = style || {};
	const fill = color || background || backgroundColor;
	return jsx("rect", {
		className: cc([
			"react-flow__minimap-node",
			{ selected },
			className
		]),
		x,
		y,
		rx: borderRadius,
		ry: borderRadius,
		width,
		height,
		style: {
			fill,
			stroke: strokeColor,
			strokeWidth
		},
		shapeRendering,
		onClick: onClick ? (event) => onClick(event, id) : void 0
	});
}
var MiniMapNode = (0, react.memo)(MiniMapNodeComponent);
var selectorNodeIds = (s) => s.nodes.map((node) => node.id);
var getAttrFunction = (func) => func instanceof Function ? func : () => func;
function MiniMapNodes({ nodeStrokeColor, nodeColor, nodeClassName = "", nodeBorderRadius = 5, nodeStrokeWidth, nodeComponent: NodeComponent = MiniMapNode, onClick }) {
	const nodeIds = useStore(selectorNodeIds, shallow$1);
	const nodeColorFunc = getAttrFunction(nodeColor);
	const nodeStrokeColorFunc = getAttrFunction(nodeStrokeColor);
	const nodeClassNameFunc = getAttrFunction(nodeClassName);
	const shapeRendering = typeof window === "undefined" || !!window.chrome ? "crispEdges" : "geometricPrecision";
	return jsx(Fragment, { children: nodeIds.map((nodeId) => jsx(NodeComponentWrapper, {
		id: nodeId,
		nodeColorFunc,
		nodeStrokeColorFunc,
		nodeClassNameFunc,
		nodeBorderRadius,
		nodeStrokeWidth,
		NodeComponent,
		onClick,
		shapeRendering
	}, nodeId)) });
}
function NodeComponentWrapperInner({ id, nodeColorFunc, nodeStrokeColorFunc, nodeClassNameFunc, nodeBorderRadius, nodeStrokeWidth, shapeRendering, NodeComponent, onClick }) {
	const { node, x, y, width, height } = useStore((s) => {
		const node = s.nodeLookup.get(id);
		if (!node) return {
			node: void 0,
			x: 0,
			y: 0,
			width: 0,
			height: 0
		};
		const userNode = node.internals.userNode;
		const { x, y } = node.internals.positionAbsolute;
		const { width, height } = getNodeDimensions(userNode);
		return {
			node: userNode,
			x,
			y,
			width,
			height
		};
	}, shallow$1);
	if (!node || node.hidden || !nodeHasDimensions(node)) return null;
	return jsx(NodeComponent, {
		x,
		y,
		width,
		height,
		style: node.style,
		selected: !!node.selected,
		className: nodeClassNameFunc(node),
		color: nodeColorFunc(node),
		borderRadius: nodeBorderRadius,
		strokeColor: nodeStrokeColorFunc(node),
		strokeWidth: nodeStrokeWidth,
		shapeRendering,
		onClick,
		id: node.id
	});
}
var NodeComponentWrapper = (0, react.memo)(NodeComponentWrapperInner);
var MiniMapNodes$1 = (0, react.memo)(MiniMapNodes);
var defaultWidth = 200;
var defaultHeight = 150;
var filterHidden = (node) => !node.hidden;
var selector$1 = (s) => {
	const viewBB = {
		x: -s.transform[0] / s.transform[2],
		y: -s.transform[1] / s.transform[2],
		width: s.width / s.transform[2],
		height: s.height / s.transform[2]
	};
	let hasVisibleNode = false;
	for (const node of s.nodeLookup.values()) if (!node.hidden) {
		hasVisibleNode = true;
		break;
	}
	return {
		viewBB,
		boundingRect: hasVisibleNode ? getBoundsOfRects(getInternalNodesBounds(s.nodeLookup, { filter: filterHidden }), viewBB) : viewBB,
		rfId: s.rfId,
		panZoom: s.panZoom,
		translateExtent: s.translateExtent,
		flowWidth: s.width,
		flowHeight: s.height,
		ariaLabelConfig: s.ariaLabelConfig
	};
};
var rectEqual = (a, b) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
var areEqual = (a, b) => rectEqual(a.viewBB, b.viewBB) && rectEqual(a.boundingRect, b.boundingRect) && a.rfId === b.rfId && a.panZoom === b.panZoom && a.translateExtent === b.translateExtent && a.flowWidth === b.flowWidth && a.flowHeight === b.flowHeight && a.ariaLabelConfig === b.ariaLabelConfig;
var ARIA_LABEL_KEY = "react-flow__minimap-desc";
function MiniMapComponent({ style, className, nodeStrokeColor, nodeColor, nodeClassName = "", nodeBorderRadius = 5, nodeStrokeWidth, nodeComponent, bgColor, maskColor, maskStrokeColor, maskStrokeWidth, position = "bottom-right", onClick, onNodeClick, pannable = false, zoomable = false, ariaLabel, inversePan, zoomStep = 1, offsetScale = 5 }) {
	const store = useStoreApi();
	const svg = (0, react.useRef)(null);
	const { boundingRect, panZoom, viewBB, rfId, translateExtent, flowWidth, flowHeight, ariaLabelConfig } = useStore(selector$1, areEqual);
	const elementWidth = style?.width ?? defaultWidth;
	const elementHeight = style?.height ?? defaultHeight;
	const scaledWidth = boundingRect.width / elementWidth;
	const scaledHeight = boundingRect.height / elementHeight;
	const viewScale = Math.max(scaledWidth, scaledHeight);
	const viewWidth = viewScale * elementWidth;
	const viewHeight = viewScale * elementHeight;
	const offset = offsetScale * viewScale;
	const x = boundingRect.x - (viewWidth - boundingRect.width) / 2 - offset;
	const y = boundingRect.y - (viewHeight - boundingRect.height) / 2 - offset;
	const width = viewWidth + offset * 2;
	const height = viewHeight + offset * 2;
	const labelledBy = `${ARIA_LABEL_KEY}-${rfId}`;
	const viewScaleRef = (0, react.useRef)(0);
	const minimapInstance = (0, react.useRef)();
	viewScaleRef.current = viewScale;
	(0, react.useEffect)(() => {
		const currentPanZoom = store.getState().panZoom;
		if (svg.current && currentPanZoom) {
			minimapInstance.current = XYMinimap({
				domNode: svg.current,
				panZoom: currentPanZoom,
				getTransform: () => store.getState().transform,
				getViewScale: () => viewScaleRef.current
			});
			return () => {
				minimapInstance.current?.destroy();
			};
		}
	}, [panZoom]);
	(0, react.useEffect)(() => {
		minimapInstance.current?.update({
			translateExtent,
			width: flowWidth,
			height: flowHeight,
			inversePan,
			pannable,
			zoomStep,
			zoomable
		});
	}, [
		pannable,
		zoomable,
		inversePan,
		zoomStep,
		translateExtent,
		flowWidth,
		flowHeight
	]);
	const onSvgClick = onClick ? (event) => {
		const [x, y] = minimapInstance.current?.pointer(event) || [0, 0];
		onClick(event, {
			x,
			y
		});
	} : void 0;
	const nodeClickHandler = (0, react.useCallback)((event, nodeId) => {
		const node = store.getState().nodeLookup.get(nodeId).internals.userNode;
		onNodeClick?.(event, node);
	}, [onNodeClick]);
	const onSvgNodeClick = onNodeClick ? nodeClickHandler : void 0;
	const _ariaLabel = ariaLabel ?? ariaLabelConfig["minimap.ariaLabel"];
	return jsx(Panel, {
		position,
		style: {
			...style,
			"--xy-minimap-background-color-props": typeof bgColor === "string" ? bgColor : void 0,
			"--xy-minimap-mask-background-color-props": typeof maskColor === "string" ? maskColor : void 0,
			"--xy-minimap-mask-stroke-color-props": typeof maskStrokeColor === "string" ? maskStrokeColor : void 0,
			"--xy-minimap-mask-stroke-width-props": typeof maskStrokeWidth === "number" ? maskStrokeWidth * viewScale : void 0,
			"--xy-minimap-node-background-color-props": typeof nodeColor === "string" ? nodeColor : void 0,
			"--xy-minimap-node-stroke-color-props": typeof nodeStrokeColor === "string" ? nodeStrokeColor : void 0,
			"--xy-minimap-node-stroke-width-props": typeof nodeStrokeWidth === "number" ? nodeStrokeWidth : void 0
		},
		className: cc(["react-flow__minimap", className]),
		"data-testid": "rf__minimap",
		children: jsxs("svg", {
			width: elementWidth,
			height: elementHeight,
			viewBox: `${x} ${y} ${width} ${height}`,
			className: "react-flow__minimap-svg",
			role: "img",
			"aria-labelledby": labelledBy,
			ref: svg,
			onClick: onSvgClick,
			children: [
				_ariaLabel && jsx("title", {
					id: labelledBy,
					children: _ariaLabel
				}),
				jsx(MiniMapNodes$1, {
					onClick: onSvgNodeClick,
					nodeColor,
					nodeStrokeColor,
					nodeBorderRadius,
					nodeClassName,
					nodeStrokeWidth,
					nodeComponent
				}),
				jsx("path", {
					className: "react-flow__minimap-mask",
					d: `M${x - offset},${y - offset}h${width + offset * 2}v${height + offset * 2}h${-width - offset * 2}z
        M${viewBB.x},${viewBB.y}h${viewBB.width}v${viewBB.height}h${-viewBB.width}z`,
					fillRule: "evenodd",
					pointerEvents: "none"
				})
			]
		})
	});
}
MiniMapComponent.displayName = "MiniMap";
(0, react.memo)(MiniMapComponent);
var scaleSelector = (calculateScale) => (store) => calculateScale ? `${Math.max(1 / store.transform[2], 1)}` : void 0;
var defaultPositions = {
	[ResizeControlVariant.Line]: "right",
	[ResizeControlVariant.Handle]: "bottom-right"
};
function ResizeControl({ nodeId, position, variant = ResizeControlVariant.Handle, className, style = void 0, children, color, minWidth = 10, minHeight = 10, maxWidth = Number.MAX_VALUE, maxHeight = Number.MAX_VALUE, keepAspectRatio = false, resizeDirection, autoScale = true, shouldResize, onResizeStart, onResize, onResizeEnd }) {
	const contextNodeId = useNodeId();
	const id = typeof nodeId === "string" ? nodeId : contextNodeId;
	const store = useStoreApi();
	const resizeControlRef = (0, react.useRef)(null);
	const isHandleControl = variant === ResizeControlVariant.Handle;
	const scale = useStore((0, react.useCallback)(scaleSelector(isHandleControl && autoScale), [isHandleControl, autoScale]), shallow$1);
	const resizer = (0, react.useRef)(null);
	const controlPosition = position ?? defaultPositions[variant];
	(0, react.useEffect)(() => {
		if (!resizeControlRef.current || !id) return;
		if (!resizer.current) resizer.current = XYResizer({
			domNode: resizeControlRef.current,
			nodeId: id,
			getStoreItems: () => {
				const { nodeLookup, transform, snapGrid, snapToGrid, nodeOrigin, domNode } = store.getState();
				return {
					nodeLookup,
					transform,
					snapGrid,
					snapToGrid,
					nodeOrigin,
					paneDomNode: domNode
				};
			},
			onChange: (change, childChanges) => {
				const { triggerNodeChanges, nodeLookup, parentLookup, nodeOrigin } = store.getState();
				const changes = [];
				const nextPosition = {
					x: change.x,
					y: change.y
				};
				const node = nodeLookup.get(id);
				if (node && node.expandParent && node.parentId) {
					const origin = node.origin ?? nodeOrigin;
					const width = change.width ?? node.measured.width ?? 0;
					const height = change.height ?? node.measured.height ?? 0;
					const parentExpandChanges = handleExpandParent([{
						id: node.id,
						parentId: node.parentId,
						rect: {
							width,
							height,
							...evaluateAbsolutePosition({
								x: change.x ?? node.position.x,
								y: change.y ?? node.position.y
							}, {
								width,
								height
							}, node.parentId, nodeLookup, origin)
						}
					}], nodeLookup, parentLookup, nodeOrigin);
					changes.push(...parentExpandChanges);
					nextPosition.x = change.x ? Math.max(origin[0] * width, change.x) : void 0;
					nextPosition.y = change.y ? Math.max(origin[1] * height, change.y) : void 0;
				}
				if (nextPosition.x !== void 0 && nextPosition.y !== void 0) {
					const positionChange = {
						id,
						type: "position",
						position: { ...nextPosition }
					};
					changes.push(positionChange);
				}
				if (change.width !== void 0 && change.height !== void 0) {
					const dimensionChange = {
						id,
						type: "dimensions",
						resizing: true,
						setAttributes: !resizeDirection ? true : resizeDirection === "horizontal" ? "width" : "height",
						dimensions: {
							width: change.width,
							height: change.height
						}
					};
					changes.push(dimensionChange);
				}
				for (const childChange of childChanges) {
					const positionChange = {
						...childChange,
						type: "position"
					};
					changes.push(positionChange);
				}
				triggerNodeChanges(changes);
			},
			onEnd: ({ width, height }) => {
				const dimensionChange = {
					id,
					type: "dimensions",
					resizing: false,
					dimensions: {
						width,
						height
					}
				};
				store.getState().triggerNodeChanges([dimensionChange]);
			}
		});
		resizer.current.update({
			controlPosition,
			boundaries: {
				minWidth,
				minHeight,
				maxWidth,
				maxHeight
			},
			keepAspectRatio,
			resizeDirection,
			onResizeStart,
			onResize,
			onResizeEnd,
			shouldResize
		});
		return () => {
			resizer.current?.destroy();
		};
	}, [
		controlPosition,
		minWidth,
		minHeight,
		maxWidth,
		maxHeight,
		keepAspectRatio,
		onResizeStart,
		onResize,
		onResizeEnd,
		shouldResize
	]);
	return jsx("div", {
		className: cc([
			"react-flow__resize-control",
			"nodrag",
			...controlPosition.split("-"),
			variant,
			className
		]),
		ref: resizeControlRef,
		style: {
			...style,
			scale,
			...color && { [isHandleControl ? "backgroundColor" : "borderColor"]: color }
		},
		children
	});
}
(0, react.memo)(ResizeControl);
//#endregion
//#region
var PHASE_BY_STATUS = {
	running: "running",
	waiting_gate: "gate",
	waiting_children: "children",
	completed: "finished",
	failed: "failed",
	stale: "stale"
};
function phaseOf(run) {
	const phase = PHASE_BY_STATUS[run.status];
	if (phase !== void 0) return phase;
	return run.outcome === "fail" ? "failed" : "finished";
}
function isLive(phase) {
	return phase === "running" || phase === "gate" || phase === "children";
}
function rootFlowOf(snapshot) {
	if (snapshot === null) return void 0;
	return snapshot.flows[snapshot.rootFlowId];
}
/** 节点展示名：优先 title，退化为 id */
function nodeLabel$1(flow, nodeId) {
	if (nodeId === null) return "";
	const title = (flow?.nodes.find((n) => n.id === nodeId))?.title?.trim();
	return title !== void 0 && title !== "" ? title : nodeId;
}
/** 分支展示名："*" 归一成"默认"，找不到时回退分支 id */
function branchLabel(flow, nodeId, branchId) {
	if (branchId === null) return null;
	const branch = (flow?.nodes.find((n) => n.id === nodeId))?.branches?.find((b) => b.id === branchId);
	if (branch === void 0) return branchId;
	return branch.condition === "*" ? null : branch.condition;
}
/**
* 已走过的路径：按执行顺序列出节点，连续重复的节点合并（环的每一圈只体现在 count 上）。
* 面板用横向"路径条"呈现，比整图更适合窄栏。
*/
function buildPath(detail) {
	const flow = rootFlowOf(detail.snapshot);
	const steps = [];
	for (const exec of detail.executions) {
		const last = steps[steps.length - 1];
		const branch = branchLabel(flow, exec.nodeId, exec.branchId);
		if (exec.status === "dispatched") {
			if (last !== void 0 && last.nodeId === exec.nodeId) {
				last.lastExecutionId = exec.id;
				continue;
			}
			steps.push({
				nodeId: exec.nodeId,
				label: nodeLabel$1(flow, exec.nodeId),
				count: 1,
				statuses: ["dispatched"],
				branch,
				lastExecutionId: exec.id
			});
			continue;
		}
		if (last !== void 0 && last.nodeId === exec.nodeId) {
			last.lastExecutionId = exec.id;
			if (branch !== null) last.branch = branch;
			if (last.statuses.length === 1 && last.statuses[0] === "dispatched") last.statuses = [exec.status];
			else {
				last.count += 1;
				last.statuses.push(exec.status);
			}
			continue;
		}
		steps.push({
			nodeId: exec.nodeId,
			label: nodeLabel$1(flow, exec.nodeId),
			count: 1,
			statuses: [exec.status],
			branch,
			lastExecutionId: exec.id
		});
	}
	return steps;
}
/** 汇聚行部分失败（§7.5）：重派后仍失败的 child 会带部分结果推进，界面要显性可见 */
function isPartialGather(payload) {
	if (typeof payload !== "object" || payload === null || !("children" in payload)) return false;
	const kids = payload.children;
	return Array.isArray(kids) && kids.some((k) => k?.status === "failed");
}
function executionTone(exec) {
	if (exec.status === "completed") return { key: isPartialGather(exec.payload) ? "partial" : "done" };
	if (exec.status === "blocked") return { key: "blocked" };
	if (exec.status === "limit_exceeded") return { key: "limit" };
	if (exec.status === "dispatched") return { key: "dispatched" };
	return { key: "unknown" };
}
/** 指令/摘要压成一行，面板里不撑破布局 */
function oneLine(text, max = 160) {
	if (text === null || text === void 0) return "";
	const flat = text.replace(/\s+/g, " ").trim();
	return flat.length <= max ? flat : `${flat.slice(0, max)}…`;
}
//#endregion
//#region
function relTime(iso, now = Date.now()) {
	if (iso === null || iso === void 0 || iso === "") return "—";
	const diff = now - new Date(iso).getTime();
	if (Number.isNaN(diff)) return "—";
	if (diff < 0) return "刚刚";
	if (diff < 6e4) return "刚刚";
	if (diff < 36e5) return `${Math.floor(diff / 6e4)} 分钟前`;
	if (diff < 864e5) return `${Math.floor(diff / 36e5)} 小时前`;
	return `${Math.floor(diff / 864e5)} 天前`;
}
function clockTime(iso) {
	if (iso === null || iso === void 0 || iso === "") return "—";
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "—";
	return date.toLocaleTimeString("zh-CN", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit"
	});
}
/** 持续时长：58s / 3m12s / 1h04m */
function duration(ms) {
	if (!Number.isFinite(ms) || ms < 0) return "—";
	const seconds = Math.floor(ms / 1e3);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m${String(seconds % 60).padStart(2, "0")}s`;
	return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}m`;
}
/** run 已运行的时长：进行中算到当前，结束的算到 finishedAt */
function elapsedOf(run, now = Date.now()) {
	const start = new Date(run.createdAt).getTime();
	if (Number.isNaN(start)) return 0;
	const end = run.finishedAt !== null ? new Date(run.finishedAt).getTime() : now;
	return Math.max(0, end - start);
}
//#endregion
//#region
function resolveEndpoint(relativePath) {
	const protocol = globalThis.location?.protocol;
	if (protocol === "http:" || protocol === "https:") return new URL(relativePath, document.baseURI);
	const raw = globalThis.__DSH_TRANSPORT__?.streamBaseUrl;
	if (typeof raw === "string" && raw !== "") try {
		const base = new URL(raw);
		if (base.protocol === "ws:") base.protocol = "http:";
		else if (base.protocol === "wss:") base.protocol = "https:";
		if (base.protocol === "http:" || base.protocol === "https:") return new URL(relativePath, base);
	} catch {}
	return new URL(relativePath, document.baseURI);
}
//#endregion
//#region
async function request(path, init) {
	const url = resolveEndpoint(`aiworkflow/${path}`);
	const response = await fetch(url, {
		...init,
		headers: {
			"content-type": "application/json",
			...init?.headers ?? {}
		},
		cache: "no-store"
	});
	const body = await response.json().catch(() => null);
	if (body === null || typeof body !== "object") throw new Error(`HTTP ${response.status}`);
	return body;
}
async function listFlows(kind) {
	return (await request(kind === void 0 ? "flows" : `flows?kind=${kind}`)).flows;
}
async function getFlow(id) {
	return (await request(`flows/${encodeURIComponent(id)}`)).flow;
}
function saveFlow(flow) {
	return request(`flows/${encodeURIComponent(flow.id)}`, {
		method: "PUT",
		body: JSON.stringify(flow)
	});
}
function deleteFlow(id) {
	return request(`flows/${encodeURIComponent(id)}`, { method: "DELETE" });
}
/** 干跑校验：与保存用同一个 validateFlow，不落库 */
async function validateFlow(flow) {
	return (await request("flows/validate", {
		method: "POST",
		body: JSON.stringify(flow)
	})).result;
}
/** 该图历史 run 里出现过的 payload 字段名（插值提示用） */
async function payloadFields(id) {
	return (await request(`flows/${encodeURIComponent(id)}/payload-fields`)).fields;
}
//#endregion
//#region
var style_default = "/* this gets exported as style.css and can be used for the default theming */\n/* these are the necessary styles for React/Svelte Flow, they get used by base.css and style.css */\n.react-flow {\n  direction: ltr;\n\n  --xy-edge-stroke-default: #b1b1b7;\n  --xy-edge-stroke-width-default: 1;\n  --xy-edge-stroke-selected-default: #555;\n\n  --xy-connectionline-stroke-default: #b1b1b7;\n  --xy-connectionline-stroke-width-default: 1;\n\n  --xy-attribution-background-color-default: rgba(255, 255, 255, 0.5);\n\n  --xy-minimap-background-color-default: #fff;\n  --xy-minimap-mask-background-color-default: rgba(240, 240, 240, 0.6);\n  --xy-minimap-mask-stroke-color-default: transparent;\n  --xy-minimap-mask-stroke-width-default: 1;\n  --xy-minimap-node-background-color-default: #e2e2e2;\n  --xy-minimap-node-stroke-color-default: transparent;\n  --xy-minimap-node-stroke-width-default: 2;\n\n  --xy-background-color-default: transparent;\n  --xy-background-pattern-dots-color-default: #91919a;\n  --xy-background-pattern-lines-color-default: #eee;\n  --xy-background-pattern-cross-color-default: #e2e2e2;\n  background-color: var(--xy-background-color, var(--xy-background-color-default));\n  --xy-node-color-default: inherit;\n  --xy-node-border-default: 1px solid #1a192b;\n  --xy-node-background-color-default: #fff;\n  --xy-node-group-background-color-default: rgba(240, 240, 240, 0.25);\n  --xy-node-boxshadow-hover-default: 0 1px 4px 1px rgba(0, 0, 0, 0.08);\n  --xy-node-boxshadow-selected-default: 0 0 0 0.5px #1a192b;\n  --xy-node-border-radius-default: 3px;\n\n  --xy-handle-background-color-default: #1a192b;\n  --xy-handle-border-color-default: #fff;\n\n  --xy-selection-background-color-default: rgba(0, 89, 220, 0.08);\n  --xy-selection-border-default: 1px dotted rgba(0, 89, 220, 0.8);\n\n  --xy-controls-button-background-color-default: #fefefe;\n  --xy-controls-button-background-color-hover-default: #f4f4f4;\n  --xy-controls-button-color-default: inherit;\n  --xy-controls-button-color-hover-default: inherit;\n  --xy-controls-button-border-color-default: #eee;\n  --xy-controls-box-shadow-default: 0 0 2px 1px rgba(0, 0, 0, 0.08);\n\n  --xy-edge-label-background-color-default: #ffffff;\n  --xy-edge-label-color-default: inherit;\n  --xy-resize-background-color-default: #3367d9;\n}\n.react-flow.dark {\n  --xy-edge-stroke-default: #3e3e3e;\n  --xy-edge-stroke-width-default: 1;\n  --xy-edge-stroke-selected-default: #727272;\n\n  --xy-connectionline-stroke-default: #b1b1b7;\n  --xy-connectionline-stroke-width-default: 1;\n\n  --xy-attribution-background-color-default: rgba(150, 150, 150, 0.25);\n\n  --xy-minimap-background-color-default: #141414;\n  --xy-minimap-mask-background-color-default: rgba(60, 60, 60, 0.6);\n  --xy-minimap-mask-stroke-color-default: transparent;\n  --xy-minimap-mask-stroke-width-default: 1;\n  --xy-minimap-node-background-color-default: #2b2b2b;\n  --xy-minimap-node-stroke-color-default: transparent;\n  --xy-minimap-node-stroke-width-default: 2;\n\n  --xy-background-color-default: #141414;\n  --xy-background-pattern-dots-color-default: #555;\n  --xy-background-pattern-lines-color-default: #333;\n  --xy-background-pattern-cross-color-default: #333;\n  --xy-node-color-default: #f8f8f8;\n  --xy-node-border-default: 1px solid #3c3c3c;\n  --xy-node-background-color-default: #1e1e1e;\n  --xy-node-group-background-color-default: rgba(240, 240, 240, 0.25);\n  --xy-node-boxshadow-hover-default: 0 1px 4px 1px rgba(255, 255, 255, 0.08);\n  --xy-node-boxshadow-selected-default: 0 0 0 0.5px #999;\n\n  --xy-handle-background-color-default: #bebebe;\n  --xy-handle-border-color-default: #1e1e1e;\n\n  --xy-selection-background-color-default: rgba(200, 200, 220, 0.08);\n  --xy-selection-border-default: 1px dotted rgba(200, 200, 220, 0.8);\n\n  --xy-controls-button-background-color-default: #2b2b2b;\n  --xy-controls-button-background-color-hover-default: #3e3e3e;\n  --xy-controls-button-color-default: #f8f8f8;\n  --xy-controls-button-color-hover-default: #fff;\n  --xy-controls-button-border-color-default: #5b5b5b;\n  --xy-controls-box-shadow-default: 0 0 2px 1px rgba(0, 0, 0, 0.08);\n\n  --xy-edge-label-background-color-default: #141414;\n  --xy-edge-label-color-default: #f8f8f8;\n}\n.react-flow__background {\n  background-color: var(--xy-background-color-props, var(--xy-background-color, var(--xy-background-color-default)));\n  pointer-events: none;\n  z-index: -1;\n}\n.react-flow__container {\n  position: absolute;\n  width: 100%;\n  height: 100%;\n  top: 0;\n  left: 0;\n}\n.react-flow__pane {\n  z-index: 1;\n  touch-action: none;\n}\n.react-flow__pane.draggable {\n    cursor: grab;\n  }\n.react-flow__pane.dragging {\n    cursor: grabbing;\n  }\n.react-flow__pane.selection {\n    cursor: pointer;\n  }\n.react-flow__viewport {\n  transform-origin: 0 0;\n  z-index: 2;\n  pointer-events: none;\n}\n.react-flow__renderer {\n  z-index: 4;\n}\n.react-flow__selection {\n  z-index: 6;\n}\n.react-flow__nodesselection-rect:focus,\n.react-flow__nodesselection-rect:focus-visible {\n  outline: none;\n}\n.react-flow__edge-path {\n  stroke: var(--xy-edge-stroke, var(--xy-edge-stroke-default));\n  stroke-width: var(--xy-edge-stroke-width, var(--xy-edge-stroke-width-default));\n  fill: none;\n}\n.react-flow__connection-path {\n  stroke: var(--xy-connectionline-stroke, var(--xy-connectionline-stroke-default));\n  stroke-width: var(--xy-connectionline-stroke-width, var(--xy-connectionline-stroke-width-default));\n  fill: none;\n}\n.react-flow .react-flow__edges {\n  position: absolute;\n}\n.react-flow .react-flow__edges svg {\n    overflow: visible;\n    position: absolute;\n    pointer-events: none;\n  }\n.react-flow__edge {\n  pointer-events: visibleStroke;\n}\n.react-flow__edge.selectable {\n    cursor: pointer;\n  }\n.react-flow__edge.animated path {\n    stroke-dasharray: 5;\n    animation: dashdraw 0.5s linear infinite;\n  }\n.react-flow__edge.animated path.react-flow__edge-interaction {\n    stroke-dasharray: none;\n    animation: none;\n  }\n.react-flow__edge.inactive {\n    pointer-events: none;\n  }\n.react-flow__edge.selected,\n  .react-flow__edge:focus,\n  .react-flow__edge:focus-visible {\n    outline: none;\n  }\n.react-flow__edge.selected .react-flow__edge-path,\n  .react-flow__edge.selectable:focus .react-flow__edge-path,\n  .react-flow__edge.selectable:focus-visible .react-flow__edge-path {\n    stroke: var(--xy-edge-stroke-selected, var(--xy-edge-stroke-selected-default));\n  }\n.react-flow__edge-textwrapper {\n    pointer-events: all;\n  }\n.react-flow__edge .react-flow__edge-text {\n    pointer-events: none;\n    -webkit-user-select: none;\n       -moz-user-select: none;\n            user-select: none;\n  }\n/* Arrowhead marker styles - use CSS custom properties as default */\n.react-flow__arrowhead polyline {\n  stroke: var(--xy-edge-stroke, var(--xy-edge-stroke-default));\n}\n.react-flow__arrowhead polyline.arrowclosed {\n  fill: var(--xy-edge-stroke, var(--xy-edge-stroke-default));\n}\n.react-flow__connection {\n  pointer-events: none;\n}\n.react-flow__connection .animated {\n    stroke-dasharray: 5;\n    animation: dashdraw 0.5s linear infinite;\n  }\nsvg.react-flow__connectionline {\n  z-index: 1001;\n  overflow: visible;\n  position: absolute;\n}\n.react-flow__nodes {\n  pointer-events: none;\n  transform-origin: 0 0;\n}\n.react-flow__node {\n  position: absolute;\n  -webkit-user-select: none;\n     -moz-user-select: none;\n          user-select: none;\n  pointer-events: all;\n  transform-origin: 0 0;\n  box-sizing: border-box;\n  cursor: default;\n}\n.react-flow__node.selectable {\n    cursor: pointer;\n  }\n.react-flow__node.draggable {\n    cursor: grab;\n    pointer-events: all;\n  }\n.react-flow__node.draggable.dragging {\n      cursor: grabbing;\n    }\n.react-flow__nodesselection {\n  z-index: 3;\n  transform-origin: left top;\n  pointer-events: none;\n}\n.react-flow__nodesselection-rect {\n    position: absolute;\n    pointer-events: all;\n    cursor: grab;\n  }\n.react-flow__handle {\n  position: absolute;\n  pointer-events: none;\n  min-width: 5px;\n  min-height: 5px;\n  width: 6px;\n  height: 6px;\n  background-color: var(--xy-handle-background-color, var(--xy-handle-background-color-default));\n  border: 1px solid var(--xy-handle-border-color, var(--xy-handle-border-color-default));\n  border-radius: 100%;\n}\n.react-flow__handle.connectingfrom {\n    pointer-events: all;\n  }\n.react-flow__handle.connectionindicator {\n    pointer-events: all;\n    cursor: crosshair;\n  }\n.react-flow__handle-bottom {\n    top: auto;\n    left: 50%;\n    bottom: 0;\n    transform: translate(-50%, 50%);\n  }\n.react-flow__handle-top {\n    top: 0;\n    left: 50%;\n    transform: translate(-50%, -50%);\n  }\n.react-flow__handle-left {\n    top: 50%;\n    left: 0;\n    transform: translate(-50%, -50%);\n  }\n.react-flow__handle-right {\n    top: 50%;\n    right: 0;\n    transform: translate(50%, -50%);\n  }\n.react-flow__edgeupdater {\n  cursor: move;\n  pointer-events: all;\n}\n.react-flow__pane.selection .react-flow__panel {\n  pointer-events: none;\n}\n.react-flow__panel {\n  position: absolute;\n  z-index: 5;\n  margin: 15px;\n}\n.react-flow__panel.top {\n    top: 0;\n  }\n.react-flow__panel.bottom {\n    bottom: 0;\n  }\n.react-flow__panel.top.center, .react-flow__panel.bottom.center {\n      left: 50%;\n      transform: translateX(-15px) translateX(-50%);\n    }\n.react-flow__panel.left {\n    left: 0;\n  }\n.react-flow__panel.right {\n    right: 0;\n  }\n.react-flow__panel.left.center, .react-flow__panel.right.center {\n      top: 50%;\n      transform: translateY(-15px) translateY(-50%);\n    }\n.react-flow__attribution {\n  font-size: 10px;\n  background: var(--xy-attribution-background-color, var(--xy-attribution-background-color-default));\n  padding: 2px 3px;\n  margin: 0;\n}\n.react-flow__attribution a {\n    text-decoration: none;\n    color: #999;\n  }\n@keyframes dashdraw {\n  from {\n    stroke-dashoffset: 10;\n  }\n}\n.react-flow__edgelabel-renderer {\n  position: absolute;\n  width: 100%;\n  height: 100%;\n  pointer-events: none;\n  -webkit-user-select: none;\n     -moz-user-select: none;\n          user-select: none;\n  left: 0;\n  top: 0;\n}\n.react-flow__viewport-portal {\n  position: absolute;\n  width: 100%;\n  height: 100%;\n  left: 0;\n  top: 0;\n  -webkit-user-select: none;\n     -moz-user-select: none;\n          user-select: none;\n}\n.react-flow__minimap {\n  background: var(\n    --xy-minimap-background-color-props,\n    var(--xy-minimap-background-color, var(--xy-minimap-background-color-default))\n  );\n}\n.react-flow__minimap-svg {\n    display: block;\n  }\n.react-flow__minimap-mask {\n    fill: var(\n      --xy-minimap-mask-background-color-props,\n      var(--xy-minimap-mask-background-color, var(--xy-minimap-mask-background-color-default))\n    );\n    stroke: var(\n      --xy-minimap-mask-stroke-color-props,\n      var(--xy-minimap-mask-stroke-color, var(--xy-minimap-mask-stroke-color-default))\n    );\n    stroke-width: var(\n      --xy-minimap-mask-stroke-width-props,\n      var(--xy-minimap-mask-stroke-width, var(--xy-minimap-mask-stroke-width-default))\n    );\n  }\n.react-flow__minimap-node {\n    fill: var(\n      --xy-minimap-node-background-color-props,\n      var(--xy-minimap-node-background-color, var(--xy-minimap-node-background-color-default))\n    );\n    stroke: var(\n      --xy-minimap-node-stroke-color-props,\n      var(--xy-minimap-node-stroke-color, var(--xy-minimap-node-stroke-color-default))\n    );\n    stroke-width: var(\n      --xy-minimap-node-stroke-width-props,\n      var(--xy-minimap-node-stroke-width, var(--xy-minimap-node-stroke-width-default))\n    );\n  }\n.react-flow__background-pattern.dots {\n    fill: var(\n      --xy-background-pattern-color-props,\n      var(--xy-background-pattern-color, var(--xy-background-pattern-dots-color-default))\n    );\n  }\n.react-flow__background-pattern.lines {\n    stroke: var(\n      --xy-background-pattern-color-props,\n      var(--xy-background-pattern-color, var(--xy-background-pattern-lines-color-default))\n    );\n  }\n.react-flow__background-pattern.cross {\n    stroke: var(\n      --xy-background-pattern-color-props,\n      var(--xy-background-pattern-color, var(--xy-background-pattern-cross-color-default))\n    );\n  }\n.react-flow__controls {\n  display: flex;\n  flex-direction: column;\n  box-shadow: var(--xy-controls-box-shadow, var(--xy-controls-box-shadow-default));\n}\n.react-flow__controls.horizontal {\n    flex-direction: row;\n  }\n.react-flow__controls-button {\n    display: flex;\n    justify-content: center;\n    align-items: center;\n    height: 26px;\n    width: 26px;\n    padding: 4px;\n    border: none;\n    background: var(--xy-controls-button-background-color, var(--xy-controls-button-background-color-default));\n    border-bottom: 1px solid\n      var(\n        --xy-controls-button-border-color-props,\n        var(--xy-controls-button-border-color, var(--xy-controls-button-border-color-default))\n      );\n    color: var(\n      --xy-controls-button-color-props,\n      var(--xy-controls-button-color, var(--xy-controls-button-color-default))\n    );\n    cursor: pointer;\n    -webkit-user-select: none;\n       -moz-user-select: none;\n            user-select: none;\n  }\n.react-flow__controls-button svg {\n      width: 100%;\n      max-width: 12px;\n      max-height: 12px;\n      fill: currentColor;\n    }\n.react-flow__edge.updating .react-flow__edge-path {\n      stroke: #777;\n    }\n.react-flow__edge-text {\n    font-size: 10px;\n  }\n.react-flow__node.selectable:focus,\n  .react-flow__node.selectable:focus-visible {\n    outline: none;\n  }\n.react-flow__node-input,\n.react-flow__node-default,\n.react-flow__node-output,\n.react-flow__node-group {\n  padding: 10px;\n  border-radius: var(--xy-node-border-radius, var(--xy-node-border-radius-default));\n  width: 150px;\n  font-size: 12px;\n  color: var(--xy-node-color, var(--xy-node-color-default));\n  text-align: center;\n  border: var(--xy-node-border, var(--xy-node-border-default));\n  background-color: var(--xy-node-background-color, var(--xy-node-background-color-default));\n}\n.react-flow__node-input.selectable:hover, .react-flow__node-default.selectable:hover, .react-flow__node-output.selectable:hover, .react-flow__node-group.selectable:hover {\n      box-shadow: var(--xy-node-boxshadow-hover, var(--xy-node-boxshadow-hover-default));\n    }\n.react-flow__node-input.selectable.selected,\n    .react-flow__node-input.selectable:focus,\n    .react-flow__node-input.selectable:focus-visible,\n    .react-flow__node-default.selectable.selected,\n    .react-flow__node-default.selectable:focus,\n    .react-flow__node-default.selectable:focus-visible,\n    .react-flow__node-output.selectable.selected,\n    .react-flow__node-output.selectable:focus,\n    .react-flow__node-output.selectable:focus-visible,\n    .react-flow__node-group.selectable.selected,\n    .react-flow__node-group.selectable:focus,\n    .react-flow__node-group.selectable:focus-visible {\n      box-shadow: var(--xy-node-boxshadow-selected, var(--xy-node-boxshadow-selected-default));\n    }\n.react-flow__node-group {\n  background-color: var(--xy-node-group-background-color, var(--xy-node-group-background-color-default));\n}\n.react-flow__nodesselection-rect,\n.react-flow__selection {\n  background: var(--xy-selection-background-color, var(--xy-selection-background-color-default));\n  border: var(--xy-selection-border, var(--xy-selection-border-default));\n}\n.react-flow__nodesselection-rect:focus,\n  .react-flow__nodesselection-rect:focus-visible,\n  .react-flow__selection:focus,\n  .react-flow__selection:focus-visible {\n    outline: none;\n  }\n.react-flow__controls-button:hover {\n      background: var(\n        --xy-controls-button-background-color-hover-props,\n        var(--xy-controls-button-background-color-hover, var(--xy-controls-button-background-color-hover-default))\n      );\n      color: var(\n        --xy-controls-button-color-hover-props,\n        var(--xy-controls-button-color-hover, var(--xy-controls-button-color-hover-default))\n      );\n    }\n.react-flow__controls-button:disabled {\n      pointer-events: none;\n    }\n.react-flow__controls-button:disabled svg {\n        fill-opacity: 0.4;\n      }\n.react-flow__controls-button:last-child {\n    border-bottom: none;\n  }\n.react-flow__controls.horizontal .react-flow__controls-button {\n    border-bottom: none;\n    border-right: 1px solid\n      var(\n        --xy-controls-button-border-color-props,\n        var(--xy-controls-button-border-color, var(--xy-controls-button-border-color-default))\n      );\n  }\n.react-flow__controls.horizontal .react-flow__controls-button:last-child {\n    border-right: none;\n  }\n.react-flow__resize-control {\n  position: absolute;\n}\n.react-flow__resize-control.left,\n.react-flow__resize-control.right {\n  cursor: ew-resize;\n}\n.react-flow__resize-control.top,\n.react-flow__resize-control.bottom {\n  cursor: ns-resize;\n}\n.react-flow__resize-control.top.left,\n.react-flow__resize-control.bottom.right {\n  cursor: nwse-resize;\n}\n.react-flow__resize-control.bottom.left,\n.react-flow__resize-control.top.right {\n  cursor: nesw-resize;\n}\n/* handle styles */\n.react-flow__resize-control.handle {\n  width: 5px;\n  height: 5px;\n  border: 1px solid #fff;\n  border-radius: 1px;\n  background-color: var(--xy-resize-background-color, var(--xy-resize-background-color-default));\n  translate: -50% -50%;\n}\n.react-flow__resize-control.handle.left {\n  left: 0;\n  top: 50%;\n}\n.react-flow__resize-control.handle.right {\n  left: 100%;\n  top: 50%;\n}\n.react-flow__resize-control.handle.top {\n  left: 50%;\n  top: 0;\n}\n.react-flow__resize-control.handle.bottom {\n  left: 50%;\n  top: 100%;\n}\n.react-flow__resize-control.handle.top.left {\n  left: 0;\n}\n.react-flow__resize-control.handle.bottom.left {\n  left: 0;\n}\n.react-flow__resize-control.handle.top.right {\n  left: 100%;\n}\n.react-flow__resize-control.handle.bottom.right {\n  left: 100%;\n}\n/* line styles */\n.react-flow__resize-control.line {\n  border-color: var(--xy-resize-background-color, var(--xy-resize-background-color-default));\n  border-width: 0;\n  border-style: solid;\n}\n.react-flow__resize-control.line.left,\n.react-flow__resize-control.line.right {\n  width: 1px;\n  transform: translate(-50%, 0);\n  top: 0;\n  height: 100%;\n}\n.react-flow__resize-control.line.left {\n  left: 0;\n  border-left-width: 1px;\n}\n.react-flow__resize-control.line.right {\n  left: 100%;\n  border-right-width: 1px;\n}\n.react-flow__resize-control.line.top,\n.react-flow__resize-control.line.bottom {\n  height: 1px;\n  transform: translate(0, -50%);\n  left: 0;\n  width: 100%;\n}\n.react-flow__resize-control.line.top {\n  top: 0;\n  border-top-width: 1px;\n}\n.react-flow__resize-control.line.bottom {\n  border-bottom-width: 1px;\n  top: 100%;\n}\n.react-flow__edge-textbg {\n  fill: var(--xy-edge-label-background-color, var(--xy-edge-label-background-color-default));\n}\n.react-flow__edge-text {\n  fill: var(--xy-edge-label-color, var(--xy-edge-label-color-default));\n}\n";
//#endregion
//#region
var PALETTE = [
	{
		type: "prompt",
		label: "指令"
	},
	{
		type: "tool",
		label: "工具"
	},
	{
		type: "subagent",
		label: "子 Agent"
	},
	{
		type: "gate",
		label: "人工卡点"
	},
	{
		type: "join",
		label: "汇聚"
	},
	{
		type: "end",
		label: "结束"
	}
];
function typeLabel(type) {
	return PALETTE.find((entry) => entry.type === type)?.label ?? type;
}
function detailOf(node) {
	switch (node.type) {
		case "prompt": return node.instruction ?? "";
		case "gate": return node.question ?? "";
		case "tool": return node.toolName ?? "";
		case "subagent":
			if (node.mode === "flowRef") return `引用 ${node.flowRef ?? ""}`;
			if (node.mode === "subflow") return node.subflow === void 0 ? "内嵌子图（未创建）" : `内嵌子图 · ${node.subflow.nodes.length} 节点`;
			return node.mode;
		case "join": return node.aggregateInstruction ?? "";
		case "end": return node.outcome;
	}
}
/** 线程摘要：省掉「一次性」这种默认值，避免每个节点都多一个无信息 chip */
function threadSummary(thread) {
	if (thread === void 0 || thread.trim() === "" || thread === "new") return void 0;
	return `线程 ${thread}`;
}
function artifactSummary(produces, consumes) {
	const from = (produces ?? []).filter((key) => key.trim() !== "");
	const to = (consumes ?? []).filter((key) => key.trim() !== "");
	if (from.length === 0 && to.length === 0) return void 0;
	if (from.length > 0 && to.length > 0) return `${from.join("/")} → ${to.join("/")}`;
	return from.length > 0 ? `产出 ${from.join("/")}` : `消费 ${to.join("/")}`;
}
function fanoutSummary(fanOut) {
	if (fanOut === void 0) return void 0;
	if (fanOut.from !== void 0 && fanOut.from.trim() !== "") return `并行 ${fanOut.from}`;
	if (fanOut.count !== void 0 && fanOut.max !== void 0) return `并行 ${fanOut.count} 项 ≤${fanOut.max}`;
	if (fanOut.count !== void 0) return `并行 ${fanOut.count} 项`;
	if (fanOut.max !== void 0) return `并行 ≤${fanOut.max}`;
}
function loopSummary(node) {
	const parts = [];
	if (node.loopId !== void 0 && node.loopId !== "") parts.push(`回路 ${node.loopId}`);
	else if (node.maxRounds !== void 0) parts.push("回路");
	if (node.maxRounds !== void 0) parts.push(`≤${node.maxRounds}`);
	if (node.iterationLimit !== void 0) parts.push(`迭代 ≤${node.iterationLimit}`);
	if (node.onLimitExceeded !== void 0) parts.push(`→ ${node.onLimitExceeded}`);
	return parts.length === 0 ? void 0 : parts.join(" ");
}
/** 概览 chip 的数据源：纯函数，便于单测与后续复用（运行图卡片等） */
function summarizeNode(node, context = {}) {
	const chips = [];
	if (node.type === "subagent") {
		const runtime = [node.role, threadSummary(node.thread)].filter((part) => part !== void 0);
		if (runtime.length > 0) chips.push({
			key: "runtime",
			label: runtime.join(" · "),
			group: "runtime"
		});
		if (node.mode === "flowRef" && node.flowRef !== void 0 && node.flowRef !== "") {
			const name = context.flowNames?.[node.flowRef];
			chips.push({
				key: "mode",
				label: `引用 ${name ?? node.flowRef}`
			});
		}
		const artifacts = artifactSummary(node.produces, node.consumes);
		if (artifacts !== void 0) chips.push({
			key: "artifacts",
			label: artifacts,
			group: "contract"
		});
		if (node.subflow !== void 0) chips.push({
			key: "subflow",
			label: `子图 ${node.subflow.nodes.length} 节点`,
			action: "open-subflow"
		});
		const fanout = fanoutSummary(node.fanOut);
		if (fanout !== void 0) chips.push({
			key: "fanout",
			label: fanout,
			group: "fanout"
		});
	}
	const loop = loopSummary(node);
	if (loop !== void 0) chips.push({
		key: "loop",
		label: loop,
		group: "loop"
	});
	const branchCount = node.type === "gate" ? node.options.length : context.edgeCount ?? 0;
	if (branchCount > 1) chips.push({
		key: "branches",
		label: node.type === "gate" ? `${branchCount} 个选项` : `${branchCount} 条分支`
	});
	return chips;
}
function autoPosition(index) {
	return {
		x: 80 + index % 3 * 260,
		y: 60 + Math.floor(index / 3) * 170
	};
}
function makeNode(type, id) {
	const title = typeLabel(type);
	switch (type) {
		case "prompt": return {
			id,
			type,
			title,
			instruction: ""
		};
		case "tool": return {
			id,
			type,
			title,
			toolName: ""
		};
		case "subagent": return {
			id,
			type,
			title,
			extraPrompt: "",
			mode: "inline"
		};
		case "gate": return {
			id,
			type,
			title,
			question: "",
			options: [{
				id: "o1",
				label: "继续"
			}, {
				id: "o2",
				label: "终止"
			}]
		};
		case "join": return {
			id,
			type,
			title,
			aggregateInstruction: "汇总子任务结果"
		};
		case "end": return {
			id,
			type,
			title,
			outcome: "success"
		};
	}
}
/** 新建 subagent.subflow 时的最小合法子图：开始 → 结束 */
function makeSubflow(name = "子图") {
	const start = makeNode("prompt", "s1");
	start.title = "子图开始";
	start.next = "s2";
	const end = makeNode("end", "s2");
	end.title = "子图结束";
	return {
		name,
		entry: "s1",
		nodes: [start, end],
		_ui: { positions: {
			s1: {
				x: 80,
				y: 90
			},
			s2: {
				x: 380,
				y: 90
			}
		} }
	};
}
/** 评审回路：子 Agent 内先评审，不通过则按 issues 修订后复审；超轮次直接结束 */
function makeReviewSubflow() {
	return {
		name: "评审回路",
		entry: "review",
		nodes: [
			{
				id: "review",
				type: "prompt",
				title: "评审",
				instruction: "按评审标准逐条检查，输出 verdict（pass/fail）与 issues；pass 才允许进入下一阶段。",
				branches: [{
					id: "pass",
					condition: "评审通过",
					to: "done"
				}, {
					id: "fix",
					condition: "*",
					to: "fix"
				}],
				loopId: "review-loop",
				maxRounds: 3,
				iterationLimit: 3,
				onLimitExceeded: "done"
			},
			{
				id: "fix",
				type: "prompt",
				title: "按评审意见修订",
				instruction: "按上一轮 issues 逐条修订，然后在 summary 里说明改了什么。",
				next: "review",
				loopId: "review-loop"
			},
			{
				id: "done",
				type: "end",
				title: "评审结束",
				outcome: "success"
			}
		],
		_ui: { positions: {
			review: {
				x: 80,
				y: 90
			},
			fix: {
				x: 380,
				y: 90
			},
			done: {
				x: 680,
				y: 90
			}
		} }
	};
}
/** 测试回路：子 Agent 内执行测试，失败按 failureType 修复后重测；超轮次结束 */
function makeTestSubflow() {
	return {
		name: "测试回路",
		entry: "test",
		nodes: [
			{
				id: "test",
				type: "prompt",
				title: "执行测试",
				instruction: "按验收标准执行测试，输出 verdict（pass/fail）与 failureType（impl/design/env）。",
				branches: [{
					id: "pass",
					condition: "测试通过",
					to: "done"
				}, {
					id: "fix",
					condition: "*",
					to: "fix"
				}],
				loopId: "test-loop",
				maxRounds: 4,
				iterationLimit: 4,
				onLimitExceeded: "done"
			},
			{
				id: "fix",
				type: "prompt",
				title: "按失败类型修复",
				instruction: "impl 改代码；design 回到设计；env 重跑测试。修完回到测试。",
				next: "test",
				loopId: "test-loop"
			},
			{
				id: "done",
				type: "end",
				title: "测试结束",
				outcome: "success"
			}
		],
		_ui: { positions: {
			test: {
				x: 80,
				y: 90
			},
			fix: {
				x: 380,
				y: 90
			},
			done: {
				x: 680,
				y: 90
			}
		} }
	};
}
var TEMPLATES = [{
	kind: "review",
	label: "评审回路",
	hint: "插入一个带内嵌评审子图的子 Agent + 完成节点；子图内是评审→修订→复审的回路",
	title: "评审回路",
	extraPrompt: "按评审标准检查当前交付物，输出 verdict（pass/fail）与 issues；不通过时给出可执行的修订项。",
	reportHint: "payload 带 verdict（pass/fail）与 issues[]；需要修订时把 issues 写具体。",
	produces: "review",
	subflow: makeReviewSubflow
}, {
	kind: "test",
	label: "测试回路",
	hint: "插入一个带内嵌测试子图的子 Agent + 完成节点；子图内按失败类型修复后重测",
	title: "测试回路",
	extraPrompt: "按验收标准执行测试，失败时归类为 impl/design/env，并驱动对应修复后重测。",
	reportHint: "payload 带 verdict（pass/fail）与 failureType（impl/design/env）。",
	produces: "test",
	subflow: makeTestSubflow
}];
/** 子图缩略图：取前 24 个节点，按包围盒归一化到 0..100 */
function subflowPreview(subflow) {
	const nodes = subflow.nodes.slice(0, 24);
	if (nodes.length === 0) return {
		count: 0,
		entry: subflow.entry,
		boxes: [],
		lines: []
	};
	const positions = subflow._ui?.positions ?? {};
	const points = nodes.map((node, index) => ({
		node,
		x: positions[node.id]?.x ?? autoPosition(index).x,
		y: positions[node.id]?.y ?? autoPosition(index).y
	}));
	const minX = Math.min(...points.map((point) => point.x));
	const minY = Math.min(...points.map((point) => point.y));
	const maxX = Math.max(...points.map((point) => point.x));
	const maxY = Math.max(...points.map((point) => point.y));
	const spanX = Math.max(1, maxX - minX + 160);
	const spanY = Math.max(1, maxY - minY + 90);
	const scale = 88 / Math.max(spanX, spanY);
	const boxW = Math.max(14, 148 * scale);
	const boxH = Math.max(8, 58 * scale);
	const originX = 6 + (100 - spanX * scale) / 2;
	const originY = 6 + (100 - spanY * scale) / 2;
	const center = /* @__PURE__ */ new Map();
	const boxes = points.map((point) => {
		const x = originX + (point.x - minX) * scale;
		const y = originY + (point.y - minY) * scale;
		center.set(point.node.id, {
			x: x + boxW / 2,
			y: y + boxH / 2
		});
		return {
			id: point.node.id,
			x,
			y,
			w: boxW,
			h: boxH,
			label: point.node.title?.trim() || point.node.id,
			entry: point.node.id === subflow.entry
		};
	});
	const known = new Set(boxes.map((box) => box.id));
	const lines = [];
	for (const point of points) {
		const targets = [];
		if (point.node.branches !== void 0 && point.node.branches.length > 0) for (const branch of point.node.branches) targets.push(branch.to);
		else if (point.node.next !== void 0) targets.push(point.node.next);
		const from = center.get(point.node.id);
		if (from === void 0) continue;
		for (const target of targets) {
			if (!known.has(target)) continue;
			const to = center.get(target);
			if (to === void 0) continue;
			lines.push({
				x1: from.x,
				y1: from.y,
				x2: to.x,
				y2: to.y
			});
		}
	}
	return {
		count: subflow.nodes.length,
		entry: subflow.entry,
		boxes,
		lines
	};
}
/** 卡片右侧要画的出口：卡点一个选项一个，其余类型交给出边数量决定 */
function outletsOf(node) {
	if (node.type !== "gate") return [];
	return (node.options ?? []).map((option) => ({
		key: option.id,
		label: option.label
	}));
}
function canvasOf(flow) {
	const positions = flow._ui?.positions ?? {};
	const nodes = flow.nodes.map((node, index) => ({
		id: node.id,
		type: "wf",
		position: positions[node.id] ?? autoPosition(index),
		data: {
			title: node.title?.trim() || node.id,
			kind: node.type,
			detail: detailOf(node),
			isEntry: node.id === flow.entry,
			outlets: outletsOf(node),
			...node.type === "subagent" && node.mode === "subflow" && node.subflow !== void 0 ? { subflow: subflowPreview(node.subflow) } : {}
		}
	}));
	const known = new Set(nodes.map((node) => node.id));
	const edges = [];
	for (const node of flow.nodes) {
		if (node.branches !== void 0 && node.branches.length > 0) {
			for (const branch of node.branches) {
				if (!known.has(branch.to)) continue;
				edges.push({
					id: `e-${node.id}-${branch.id}`,
					source: node.id,
					target: branch.to,
					label: branch.condition === "*" ? "默认" : branch.condition || "条件",
					data: {
						branchId: branch.id,
						condition: branch.condition,
						when: branch.when,
						outlet: branch.outlet
					}
				});
			}
			continue;
		}
		if (node.next !== void 0 && known.has(node.next)) edges.push({
			id: `e-${node.id}`,
			source: node.id,
			target: node.next,
			data: {}
		});
	}
	return {
		nodes,
		edges
	};
}
/** 分支 id 必须唯一：新边优先用 preferred，撞了再加后缀（不改已有分支的 id，gate 的 outlet 靠它） */
function uniqueBranchId(preferred, used) {
	if (!used.has(preferred)) return preferred;
	for (let suffix = 2;; suffix += 1) {
		const candidate = `${preferred}-${suffix}`;
		if (!used.has(candidate)) return candidate;
	}
}
/**
* 画布渲染用：把每条出边挂到正确的 source handle 上。
* - 节点声明了出口（卡点：一个选项一个）→ 按 `edge.data.outlet` 找 `out-<选项 id>`，出口名字就挂在卡片右侧；
* - 没声明出口（其他类型）→ 按出边顺序 `out-0 / out-1 …`，一个分支一个点。
* 只影响渲染；保存用的还是 page.tsx 里那份 edges 状态（不含 handle 绑定）。
*/
function spreadSourceHandles(edges, outletKeys) {
	const counters = /* @__PURE__ */ new Map();
	let changed = false;
	const next = edges.map((edge) => {
		const index = counters.get(edge.source) ?? 0;
		counters.set(edge.source, index + 1);
		const keys = outletKeys?.get(edge.source);
		const bound = keys === void 0 ? -1 : keys.indexOf(edge.data?.outlet ?? "");
		const handle = `out-${keys === void 0 ? String(index) : keys[bound >= 0 ? bound : Math.min(index, keys.length - 1)] ?? String(index)}`;
		if (edge.sourceHandle === handle) return edge;
		changed = true;
		return {
			...edge,
			sourceHandle: handle
		};
	});
	return changed ? next : edges;
}
function buildFlow(base, bodies, nodes, edges) {
	const outgoing = /* @__PURE__ */ new Map();
	for (const edge of edges) {
		const list = outgoing.get(edge.source) ?? [];
		list.push(edge);
		outgoing.set(edge.source, list);
	}
	const order = [];
	for (const node of nodes) if (bodies[node.id] !== void 0) order.push(node.id);
	const positions = {};
	const flowNodes = order.map((id) => {
		const canvasNode = nodes.find((node) => node.id === id);
		if (canvasNode !== void 0) positions[id] = canvasNode.position;
		const body = bodies[id];
		if (body === void 0) throw new Error(`节点 ${id} 缺少定义`);
		const node = {
			...body,
			title: typeof canvasNode?.data.title === "string" ? canvasNode.data.title : body.title
		};
		const outs = outgoing.get(id) ?? [];
		if (outs.length === 0) {
			delete node.next;
			delete node.branches;
		} else if (outs.length === 1) {
			const single = outs[0];
			const singleOutlet = single.data?.outlet;
			const meta = single.data ?? {};
			const wasBranch = (body.branches?.length ?? 0) > 0 || meta.branchId !== void 0 || meta.condition !== void 0 || meta.when !== void 0;
			if (body.type === "gate" && singleOutlet !== void 0) {
				const previous = body.branches?.find((branch) => branch.id === single.data?.branchId);
				const option = (body.options ?? []).find((item) => item.id === singleOutlet);
				node.branches = [{
					...previous ?? {},
					id: previous?.id ?? uniqueBranchId(single.data?.branchId ?? "b1", /* @__PURE__ */ new Set()),
					condition: option?.label?.trim() || previous?.condition || "*",
					to: single.target,
					outlet: singleOutlet
				}];
				delete node.next;
			} else if (wasBranch) {
				const previous = body.branches?.find((branch) => branch.id === meta.branchId);
				const dataCondition = meta.condition;
				const condition = dataCondition !== void 0 ? dataCondition : previous?.condition ?? "*";
				const branch = {
					...previous ?? {},
					id: previous?.id ?? uniqueBranchId(meta.branchId ?? "b1", /* @__PURE__ */ new Set()),
					condition,
					to: single.target
				};
				const rawOutlet = meta.outlet;
				const outlet = rawOutlet !== void 0 ? rawOutlet === "" ? void 0 : rawOutlet : previous?.outlet;
				if (outlet !== void 0) branch.outlet = outlet;
				const dataWhen = meta.when;
				const when = dataWhen !== void 0 ? dataWhen.trim() === "" ? void 0 : dataWhen.trim() : previous?.when;
				if (when !== void 0) branch.when = when;
				else delete branch.when;
				node.branches = [branch];
				delete node.next;
			} else {
				node.next = single.target;
				delete node.branches;
			}
		} else {
			const usedBranchIds = /* @__PURE__ */ new Set();
			node.branches = outs.map((edge, index) => {
				const previous = body.branches?.find((branch) => branch.id === edge.data?.branchId);
				const dataCondition = edge.data?.condition;
				const condition = dataCondition !== void 0 ? dataCondition : previous?.condition ?? (index === 0 ? "*" : "");
				const rawOutlet = edge.data?.outlet;
				const outlet = rawOutlet !== void 0 ? rawOutlet === "" ? void 0 : rawOutlet : previous?.outlet;
				const dataWhen = edge.data?.when;
				const when = dataWhen !== void 0 ? dataWhen.trim() === "" ? void 0 : dataWhen.trim() : previous?.when;
				const branch = previous !== void 0 ? {
					...previous,
					to: edge.target,
					condition,
					...outlet !== void 0 ? { outlet } : {}
				} : {
					id: uniqueBranchId(edge.data?.branchId ?? `b${index + 1}`, usedBranchIds),
					condition,
					to: edge.target,
					...outlet !== void 0 ? { outlet } : {}
				};
				if (when !== void 0) branch.when = when;
				else delete branch.when;
				usedBranchIds.add(branch.id);
				return branch;
			});
			if (body.type === "gate") {
				const gateOptions = body.options ?? [];
				node.branches = node.branches.map((branch, index) => {
					const option = gateOptions.find((item) => item.id === branch.outlet) ?? gateOptions[index];
					const outlet = branch.outlet ?? option?.id;
					const condition = branch.condition === "" || branch.condition === "*" ? option?.label?.trim() || "*" : branch.condition;
					return {
						...branch,
						condition,
						...outlet !== void 0 ? { outlet } : {}
					};
				});
			}
			delete node.next;
		}
		return node;
	});
	const entry = order.includes(base.entry) ? base.entry : order[0] ?? base.entry;
	return {
		...base,
		entry,
		nodes: flowNodes,
		_ui: {
			...base._ui ?? {},
			positions
		}
	};
}
//#endregion
//#region
var editorCss = `
.wf-page{display:flex;flex-direction:column;height:100%;min-height:420px;min-width:0;position:relative;color:var(--dsw-alias-label-primary);font-size:13px}
.wf-head{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;flex-wrap:wrap}
.wf-title{font-weight:600;font-size:13px}
.wf-sub{color:var(--dsw-alias-label-secondary);font-size:11.5px}
.wf-spacer{flex:1}
/* 流程库类型切换：流程 / 子 Agent 配置 */
.wf-lib-tabs{display:flex;gap:2px;padding:2px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);
  background:var(--dsw-alias-bg-layer-2)}
.wf-lib-tab{height:24px;padding:0 9px;border:0;border-radius:6px;background:transparent;
  color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;white-space:nowrap}
.wf-lib-tab:hover:not([data-active="true"]){color:var(--dsw-alias-label-primary)}
.wf-lib-tab[data-active="true"]{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);
  font-weight:600;box-shadow:0 1px 2px rgba(15,23,42,.12)}
.wf-btn{height:26px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);
  background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}
.wf-btn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
/* 品牌色填充时用背景色当反色文字：浅色主题(蓝底)与深色主题(白底)都能读 */
.wf-btn[data-primary="true"]{background:var(--dsw-alias-brand-primary);border-color:transparent;color:var(--dsw-alias-bg-base)}
.wf-btn[data-primary="true"]:hover{filter:brightness(1.06)}
.wf-btn:disabled{opacity:.5;cursor:default}
.wf-input{height:26px;padding:0 8px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);
  background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;outline:none;min-width:0}
.wf-input:focus{border-color:var(--dsw-alias-brand-primary)}
.wf-palette{display:flex;align-items:center;gap:6px;padding:8px 14px;flex:none;flex-wrap:wrap;
  border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.wf-body{flex:1;display:flex;min-height:0;position:relative}
.wf-canvas{flex:1;min-width:0;min-height:0;position:relative;background:var(--dsw-alias-bg-base);
  /* React Flow 的主题变量改接到 DSH token，明暗主题一起跟随 */
  --xy-background-color:var(--dsw-alias-bg-base);
  --xy-background-pattern-color:var(--dsw-alias-border-l2);
  --xy-edge-stroke:var(--dsw-alias-border-l2);
  --xy-edge-stroke-selected:var(--dsw-alias-brand-primary);
  --xy-edge-stroke-width:1.4;
  --xy-edge-label-background-color:var(--dsw-alias-bg-layer-2);
  --xy-edge-label-color:var(--dsw-alias-label-secondary);
  --xy-connectionline-stroke:var(--dsw-alias-brand-primary);
  --xy-handle-background-color:var(--dsw-alias-brand-primary);
  --xy-handle-border-color:var(--dsw-alias-bg-layer-1);
  --xy-selection-background-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent);
  --xy-selection-border:1px dashed var(--dsw-alias-brand-primary);
  --xy-controls-button-background-color:var(--dsw-alias-bg-layer-2);
  --xy-controls-button-background-color-hover:var(--dsw-alias-bg-layer-1);
  --xy-controls-button-color:var(--dsw-alias-label-primary);
  --xy-controls-button-border-color:var(--dsw-alias-border-l1);
  --xy-controls-box-shadow:0 0 0 1px var(--dsw-alias-border-l1);
  --xy-attribution-background-color:transparent}
.wf-flow{width:100%;height:100%}
.wf-inspector{flex:none;min-width:0;overflow:hidden;background:var(--dsw-alias-bg-layer-1)}
/* 面板三段式：页签固定、内容滚动、底部动作固定；头部在滚动区里吸顶 */
.wf-insp-root{display:flex;flex-direction:column;height:100%;min-height:0;container-type:inline-size}
.wf-insp-tabs{flex:none;display:flex;gap:2px;padding:8px 12px 0;border-bottom:1px solid var(--dsw-alias-border-l1)}
.wf-tab{height:30px;padding:0 10px;border:0;border-bottom:2px solid transparent;background:transparent;
  color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;font-weight:600;cursor:pointer}
.wf-tab:hover{color:var(--dsw-alias-label-primary)}
.wf-tab[data-active="true"]{color:var(--dsw-alias-label-primary);border-bottom-color:var(--dsw-alias-brand-primary)}
.wf-insp-scroll{flex:1;min-height:0;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:12px}
.wf-insp-head{flex:none;padding:10px 12px 8px;
  background:var(--dsw-alias-bg-layer-1);border-bottom:1px solid var(--dsw-alias-border-l1);
  display:flex;flex-direction:column;gap:6px}
.wf-insp-head-row{display:flex;align-items:center;gap:8px;min-width:0}
.wf-insp-title{flex:1;min-width:0;height:26px;padding:0 2px;border:0;border-bottom:1px solid transparent;
  background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;font-weight:700;
  outline:none;border-radius:0}
.wf-insp-title:focus{border-bottom-color:var(--dsw-alias-brand-primary)}
.wf-insp-title::placeholder{color:var(--dsw-alias-label-secondary);font-weight:600}
.wf-icon-btn{flex:none;width:22px;height:22px;padding:0;border-radius:6px;border:1px solid var(--dsw-alias-border-l1);
  background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;
  line-height:1;cursor:pointer}
.wf-icon-btn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary)}
/* 概览 chip：头部一眼看到角色/线程/产物/子图/回路/分支；单行横滚，避免多行把头部撑高 */
.wf-chips{display:flex;flex-wrap:nowrap;gap:4px;overflow-x:auto;scrollbar-width:none}
.wf-chips::-webkit-scrollbar{display:none}
.wf-sum-chip{flex:none;max-width:100%;padding:2px 7px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);
  background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font:inherit;font-size:10.5px;
  line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
button.wf-sum-chip{cursor:pointer}
button.wf-sum-chip:hover{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary)}
.wf-sum-label{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* 高级字段的说明收进 label 右侧的小 i */
.wf-tip{display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;margin-left:5px;
  border-radius:50%;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);
  font-size:9px;font-weight:700;font-style:normal;cursor:help;vertical-align:1px}
/* 分段控件：执行方式 / 结束结果 */
.wf-seg{display:flex;gap:2px;padding:2px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);
  background:var(--dsw-alias-bg-base)}
.wf-seg button{flex:1;height:22px;padding:0 6px;border:0;border-radius:6px;background:transparent;
  color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;cursor:pointer;white-space:nowrap}
.wf-seg button:hover:not([data-active="true"]){background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.wf-seg button[data-active="true"]{background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);font-weight:600}
.wf-mode-row{display:flex;align-items:center;gap:8px;justify-content:space-between}
.wf-mode-row .wf-hint{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* 高级设置：一行一个折叠组，折叠头显示当前值摘要 */
.wf-adv{display:flex;flex-direction:column}
.wf-acc{border-top:1px solid var(--dsw-alias-border-l1)}
.wf-adv .wf-acc:last-child{border-bottom:1px solid var(--dsw-alias-border-l1)}
.wf-acc-head{display:flex;align-items:center;gap:6px;width:100%;height:32px;padding:0 2px;border:0;
  background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;text-align:left;cursor:pointer}
.wf-acc-head:hover .wf-acc-title{color:var(--dsw-alias-brand-primary)}
.wf-acc-caret{flex:none;font-size:10px;color:var(--dsw-alias-label-secondary);transition:transform .12s}
.wf-acc-caret[data-open="true"]{transform:rotate(90deg)}
.wf-acc-title{flex:none;font-weight:600}
.wf-acc-summary{flex:1;min-width:0;text-align:right;font-size:10.5px;color:var(--dsw-alias-label-secondary);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wf-acc-body{display:flex;flex-direction:column;gap:10px;padding:2px 0 10px}
/* 窄面板下高级两列退化成单列 */
.wf-grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
@container (max-width:280px){.wf-grid2{grid-template-columns:1fr}}
/* 卡点选项行：label + 目标 + 删除 */
.wf-opt-row{display:flex;align-items:center;gap:6px}
.wf-opt-row .wf-input{flex:1;min-width:0}
.wf-opt-target{flex:none;max-width:84px;font-size:10.5px;color:var(--dsw-alias-label-secondary);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wf-opt-target[data-empty="true"]{color:var(--dsw-alias-state-warn-primary)}
/* 当前节点的校验问题 */
.wf-issues{display:flex;flex-direction:column;gap:4px;padding:8px 10px;border-radius:8px;
  border:1px solid var(--dsw-alias-state-warn-primary);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 7%,transparent)}
.wf-issues[data-has-error="true"]{border-color:var(--dsw-alias-state-error-primary);
  background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 7%,transparent)}
.wf-issues-head{font-size:11px;font-weight:700;color:var(--dsw-alias-state-warn-primary)}
.wf-issues[data-has-error="true"] .wf-issues-head{color:var(--dsw-alias-state-error-primary)}
.wf-issue{display:flex;gap:6px;font-size:11px;line-height:1.45;color:var(--dsw-alias-label-secondary)}
.wf-issue code{flex:none;font-size:10px;color:var(--dsw-alias-state-error-primary)}
.wf-issue[data-kind="warning"] code{color:var(--dsw-alias-state-warn-primary)}
/* 图页签里的角色卡 */
.wf-agent{display:flex;flex-direction:column;gap:6px;padding:8px;border-radius:8px;
  border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.wf-insp-empty{display:flex;flex-direction:column;gap:8px;padding:4px 2px}
.wf-insp-empty-title{font-size:12px;font-weight:700}
.wf-insp-foot{flex:none;display:flex;align-items:center;gap:8px;padding:10px 12px;
  border-top:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
/* 画布 / 属性面板之间的分隔条：拖动改宽度，双击复位 */
.wf-splitter{flex:none;width:7px;cursor:col-resize;position:relative;background:transparent;
  touch-action:none;user-select:none;outline:none}
.wf-splitter::after{content:'';position:absolute;left:3px;top:0;bottom:0;width:1px;
  background:var(--dsw-alias-border-l1);transition:background .12s,width .12s,left .12s}
.wf-splitter:hover::after,.wf-splitter:focus-visible::after,
.wf-splitter[data-dragging="true"]::after{left:2px;width:2px;background:var(--dsw-alias-brand-primary)}
.wf-field{display:flex;flex-direction:column;gap:5px}
/* 字段名加粗、用主文字色；说明文字单独一行（.wf-hint），不再和 label 混在一句里 */
.wf-label{font-size:12px;font-weight:700;color:var(--dsw-alias-label-primary);letter-spacing:.01em;line-height:1.3}
.wf-hint{font-size:11px;color:var(--dsw-alias-label-secondary);line-height:1.5}
.wf-hint-warn{color:var(--dsw-alias-state-warn-primary)}
.wf-section{display:flex;flex-direction:column;gap:10px}
/* 核心字段：类型已经在头部标了，不再套一层同名区块标题 */
.wf-core{display:flex;flex-direction:column;gap:10px}
.wf-section-title{font-size:10.5px;font-weight:700;color:var(--dsw-alias-label-secondary);letter-spacing:.08em;
  text-transform:uppercase;padding-bottom:5px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.wf-kind{font-size:10.5px;font-weight:700;letter-spacing:.04em;padding:2px 7px;border-radius:6px;
  border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}
.wf-id{flex:1;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10.5px;color:var(--dsw-alias-label-secondary);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.wf-chip{font-size:10px;font-weight:700;padding:1px 6px;border-radius:999px;color:var(--dsw-alias-bg-base);
  background:var(--dsw-alias-brand-primary)}
.wf-area{min-height:76px;padding:6px 8px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);
  background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;
  resize:vertical;outline:none;width:100%;box-sizing:border-box}
.wf-area:focus{border-color:var(--dsw-alias-brand-primary)}
.wf-row{display:flex;align-items:center;gap:6px}
.wf-row .wf-input{flex:1}
.wf-note{font-size:11px;color:var(--dsw-alias-label-secondary);line-height:1.5}
/* 右键菜单：视口坐标 fixed，贴边时由组件翻进视口 */
.wf-menu{position:fixed;z-index:90;min-width:196px;max-width:280px;padding:5px;border-radius:10px;
  border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-overlay);box-shadow:0 10px 30px rgba(15,23,42,.24);
  display:flex;flex-direction:column;gap:1px}
.wf-menu-head{padding:4px 8px 5px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
  color:var(--dsw-alias-label-secondary)}
.wf-menu-item{display:flex;align-items:center;gap:10px;width:100%;padding:6px 8px;border:0;border-radius:7px;
  background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;text-align:left;cursor:pointer}
.wf-menu-item:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
.wf-menu-item:disabled{opacity:.45;cursor:default}
.wf-menu-item[data-danger="true"]{color:var(--dsw-alias-state-error-primary)}
.wf-menu-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wf-menu-hint{flex:none;font-size:10.5px;color:var(--dsw-alias-label-secondary)}
.wf-menu-caret{flex:none;font-size:13px;line-height:1;color:var(--dsw-alias-label-secondary);opacity:.75}
.wf-menu-group{position:relative}
/* 子菜单：贴父项右侧（重叠 2px，避免斜着移过去时中间漏 hover），靠右边缘时翻到左侧 */
.wf-menu.wf-submenu{position:absolute;top:-5px;left:calc(100% - 2px);margin:0}
.wf-menu.wf-submenu[data-side="left"]{left:auto;right:calc(100% - 2px)}
.wf-btn[data-danger="true"]{color:var(--dsw-alias-state-error-primary)}
.wf-btn[data-danger="true"]:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-state-error-primary)}
.wf-btn[data-tone="error"]{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}
.wf-btn[data-tone="warn"]{color:var(--dsw-alias-state-warn-primary);border-color:var(--dsw-alias-state-warn-primary)}
.wf-btn[data-tone="ok"]{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}
/* 实时校验浮层：贴在页头下方，点条目定位节点 */
.wf-val-pop{position:absolute;top:46px;left:14px;z-index:95;width:min(560px,calc(100% - 28px));
  max-height:min(420px,60vh);overflow:auto;padding:10px;border-radius:12px;
  border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-overlay);
  box-shadow:0 12px 32px rgba(15,23,42,.24);display:flex;flex-direction:column;gap:4px}
.wf-val-head{font-size:11px;font-weight:700;color:var(--dsw-alias-label-secondary);letter-spacing:.04em;padding:0 2px 4px}
.wf-val-item{display:flex;gap:8px;align-items:flex-start;width:100%;text-align:left;padding:6px 8px;
  border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);
  font:inherit;font-size:12px;cursor:pointer}
.wf-val-item:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
.wf-val-item:disabled{cursor:default;opacity:.75}
.wf-val-item[data-kind="error"] .wf-val-code{color:var(--dsw-alias-state-error-primary)}
.wf-val-item[data-kind="warning"] .wf-val-code{color:var(--dsw-alias-state-warn-primary)}
.wf-val-code{flex:none;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10.5px;padding-top:1px}
.wf-val-msg{flex:1;line-height:1.45}
/* 插值提示 */
.wf-hints{margin-top:2px}
.wf-hints summary{cursor:pointer;font-size:11px;color:var(--dsw-alias-label-secondary);outline:none}
.wf-hints-node{display:flex;flex-direction:column;gap:4px;margin-top:6px}
.wf-hints-name{font-size:11px;color:var(--dsw-alias-label-secondary)}
.wf-hints-name code{font-size:10.5px}
.wf-hints-chips{display:flex;flex-wrap:wrap;gap:4px}
.wf-hints-chip{max-width:100%;padding:2px 6px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1);
  background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10.5px;cursor:pointer;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wf-hints-chip:hover{border-color:var(--dsw-alias-brand-primary)}
.wf-list{display:flex;flex-direction:column;gap:2px;overflow-y:auto;padding:8px;flex:1}
.wf-item{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;border:1px solid transparent;cursor:pointer}
.wf-item:hover{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l1)}
.wf-item-name{font-weight:550;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wf-item-meta{font-size:11px;color:var(--dsw-alias-label-secondary)}
.wf-empty{padding:32px 18px;text-align:center;color:var(--dsw-alias-label-secondary);display:flex;flex-direction:column;gap:8px;align-items:center}
.wf-banner{margin:8px 14px 0;padding:8px 10px;border-radius:8px;font-size:12px;
  border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2)}
.wf-banner[data-kind="error"]{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.wf-banner[data-kind="ok"]{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary)}
.wf-banner ul{margin:4px 0 0;padding-left:16px}
.wf-node{position:relative;min-width:132px;max-width:188px;padding:8px 10px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2);
  background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);box-shadow:0 2px 8px rgba(15,23,42,.12)}
.wf-node[data-selected="true"]{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 1px var(--dsw-alias-brand-primary)}
.wf-node[data-kind="gate"]{border-left:3px solid var(--dsw-alias-state-warn-primary)}
.wf-node[data-kind="end"]{border-left:3px solid var(--dsw-alias-state-success-primary)}
.wf-node[data-kind="subagent"]{border-left:3px solid var(--dsw-alias-brand-primary)}
.wf-node-kind{font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--dsw-alias-label-secondary);font-weight:700}
.wf-entry-badge{margin-left:6px;padding:0 5px;border-radius:999px;background:var(--dsw-alias-brand-primary);
  color:var(--dsw-alias-bg-base);font-size:9px;letter-spacing:.02em;vertical-align:1px}
.wf-node-title{font-size:12.5px;font-weight:600;margin-top:1px;word-break:break-word}
.wf-node-detail{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:2px;overflow:hidden;text-overflow:ellipsis;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word}
.wf-node[data-subflow="true"]{min-width:208px;max-width:252px}
.wf-subflow{margin-top:6px;padding-top:5px;border-top:1px dashed var(--dsw-alias-border-l2)}
.wf-subflow-head{display:flex;align-items:center;gap:6px;font-size:9.5px;color:var(--dsw-alias-label-secondary)}
.wf-subflow-open{margin-left:auto;padding:1px 6px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);
  background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:9.5px;line-height:15px;cursor:pointer}
.wf-subflow-open:hover{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
.wf-subflow-map{display:block;width:100%;height:76px;margin-top:3px;color:var(--dsw-alias-label-secondary)}
.wf-crumb{display:flex;align-items:center;gap:5px;max-width:46vw;overflow:hidden;white-space:nowrap;
  font-size:11px;color:var(--dsw-alias-label-secondary)}
.wf-crumb b{font-weight:600;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis}
.react-flow__attribution{background:transparent;color:var(--dsw-alias-label-secondary);font-size:9px;opacity:.6}
/* 卡点：没连线的出口名字挂在卡片右侧外面，点它开始连线 */
.wf-outlet-tag{position:absolute;left:calc(100% + 12px);transform:translateY(-50%);max-width:160px;
  padding:1px 7px;border-radius:999px;border:1px dashed var(--dsw-alias-border-l2);
  background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:10px;line-height:16px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;user-select:none;
  box-shadow:0 1px 4px rgba(15,23,42,.10)}
.wf-outlet-tag:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary);
  border-style:solid;background:var(--dsw-alias-bg-overlay)}
.wf-connect-hint{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:6;
  display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:999px;
  border:1px solid var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-overlay);
  color:var(--dsw-alias-label-primary);font-size:12px;box-shadow:0 6px 18px rgba(15,23,42,.22)}
.wf-outlet-row{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:3px 0}
.wf-outlet-name{font-weight:600;font-size:12px;color:var(--dsw-alias-label-primary);word-break:break-word}
`;
//#endregion
//#region
/** 点卡片右侧的出口名字 = 开始连一条线（再点目标节点完成），回调由页面给 */
var OutletClickContext = react.createContext(() => {});
/** 点子图卡片里的「打开」= 进入内嵌子图编辑，回调由页面给 */
var OpenSubflowContext = react.createContext(() => {});
function WfNode({ id, data, selected }) {
	const outCount = useStore((state) => state.edges.reduce((total, edge) => edge.source === id ? total + 1 : total, 0));
	const wired = useStore((state) => state.edges.filter((edge) => edge.source === id && typeof edge.data?.outlet === "string").map((edge) => edge.data?.outlet).join("|"));
	const onOutletClick = react.useContext(OutletClickContext);
	const onOpenSubflow = react.useContext(OpenSubflowContext);
	const preview = data.subflow;
	const declared = data.outlets ?? [];
	const slots = declared.length > 0 ? declared.map((outlet) => ({
		key: outlet.key,
		label: outlet.label
	})) : Array.from({ length: Math.max(outCount, 1) }, (_, index) => ({
		key: String(index),
		label: void 0
	}));
	const wiredKeys = new Set(wired === "" ? [] : wired.split("|"));
	return /* @__PURE__ */ react.createElement("div", {
		className: "wf-node",
		"data-kind": data.kind,
		"data-selected": selected ? "true" : "false",
		"data-subflow": preview === void 0 ? void 0 : "true"
	}, !data.isEntry && /* @__PURE__ */ react.createElement(Handle, {
		type: "target",
		position: Position.Left
	}), /* @__PURE__ */ react.createElement("div", { className: "wf-node-kind" }, typeLabel(data.kind), data.isEntry && /* @__PURE__ */ react.createElement("span", { className: "wf-entry-badge" }, "入口")), /* @__PURE__ */ react.createElement("div", { className: "wf-node-title" }, data.title), data.detail !== "" && /* @__PURE__ */ react.createElement("div", { className: "wf-node-detail" }, data.detail), preview !== void 0 && /* @__PURE__ */ react.createElement("div", { className: "wf-subflow" }, /* @__PURE__ */ react.createElement("div", { className: "wf-subflow-head" }, /* @__PURE__ */ react.createElement("span", null, "内嵌子图 · ", preview.count, " 节点"), /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "wf-subflow-open nodrag",
		onPointerDown: (event) => event.stopPropagation(),
		onClick: (event) => {
			event.stopPropagation();
			onOpenSubflow(id);
		}
	}, "打开")), /* @__PURE__ */ react.createElement("svg", {
		className: "wf-subflow-map",
		viewBox: "0 0 100 100",
		role: "img",
		"aria-label": "子图缩略图"
	}, preview.lines.map((line, index) => /* @__PURE__ */ react.createElement("line", {
		key: `l-${index}`,
		x1: line.x1,
		y1: line.y1,
		x2: line.x2,
		y2: line.y2,
		stroke: "currentColor",
		strokeOpacity: .35,
		strokeWidth: .8
	})), preview.boxes.map((box) => /* @__PURE__ */ react.createElement("g", { key: box.id }, /* @__PURE__ */ react.createElement("rect", {
		x: box.x,
		y: box.y,
		width: box.w,
		height: box.h,
		rx: 1.4,
		fill: box.entry ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-bg-layer-2)",
		fillOpacity: box.entry ? .9 : .8,
		stroke: "var(--dsw-alias-border-l2)",
		strokeWidth: .5
	}, /* @__PURE__ */ react.createElement("title", null, box.label)), /* @__PURE__ */ react.createElement("text", {
		x: box.x + box.w / 2,
		y: box.y + box.h / 2 + 1.1,
		textAnchor: "middle",
		fontSize: 3.1,
		fill: box.entry ? "var(--dsw-alias-bg-base)" : "var(--dsw-alias-label-secondary)"
	}, box.label.length > 8 ? `${box.label.slice(0, 8)}…` : box.label))))), slots.map((slot, index) => /* @__PURE__ */ react.createElement(react.Fragment, { key: slot.key }, /* @__PURE__ */ react.createElement(Handle, {
		id: `out-${slot.key}`,
		type: "source",
		position: Position.Right,
		style: { top: `${(index + 1) / (slots.length + 1) * 100}%` }
	}), slot.label !== void 0 && !wiredKeys.has(slot.key) && /* @__PURE__ */ react.createElement("span", {
		className: "wf-outlet-tag",
		"data-node": id,
		"data-outlet": slot.key,
		style: { top: `${(index + 1) / (slots.length + 1) * 100}%` },
		title: "点击后再点目标节点即可连上；也可以直接从圆点拖线",
		onPointerDown: (event) => {
			event.stopPropagation();
		},
		onClick: (event) => {
			event.stopPropagation();
			onOutletClick(id, slot.key);
		}
	}, slot.label))));
}
var nodeTypes$1 = { wf: WfNode };
var edgeTypes = {};
function CanvasFlow(props) {
	const flow = useReactFlow();
	const wrapRef = react.useRef(null);
	const apiSink = react.useRef(props.onApi);
	apiSink.current = props.onApi;
	const outletKeys = react.useMemo(() => {
		const map = /* @__PURE__ */ new Map();
		for (const node of props.nodes) {
			const outlets = node.data.outlets ?? [];
			if (outlets.length > 0) map.set(node.id, outlets.map((outlet) => outlet.key));
		}
		return map;
	}, [props.nodes]);
	const renderedEdges = react.useMemo(() => spreadSourceHandles(props.edges, outletKeys), [props.edges, outletKeys]);
	react.useEffect(() => {
		apiSink.current({
			center: () => {
				const element = wrapRef.current;
				if (element === null) return {
					x: 0,
					y: 0
				};
				const rect = element.getBoundingClientRect();
				return flow.screenToFlowPosition({
					x: rect.left + rect.width / 2,
					y: rect.top + rect.height / 2
				});
			},
			focusNode: (id) => {
				flow.fitView({
					nodes: [{ id }],
					padding: .6,
					duration: 300
				});
			},
			fitAll: () => {
				flow.fitView({
					padding: .25,
					duration: 220
				});
			}
		});
	}, [flow]);
	const openPaneMenu = (event) => {
		event.preventDefault();
		props.onPaneMenu({
			x: event.clientX,
			y: event.clientY
		}, flow.screenToFlowPosition({
			x: event.clientX,
			y: event.clientY
		}));
	};
	return /* @__PURE__ */ react.createElement("div", {
		className: "wf-flow",
		ref: wrapRef
	}, /* @__PURE__ */ react.createElement(OutletClickContext.Provider, { value: props.onOutletClick }, /* @__PURE__ */ react.createElement(OpenSubflowContext.Provider, { value: props.onOpenSubflow }, /* @__PURE__ */ react.createElement(index, {
		nodes: props.nodes,
		edges: renderedEdges,
		nodeTypes: nodeTypes$1,
		edgeTypes,
		onNodesChange: props.onNodesChange,
		onEdgesChange: props.onEdgesChange,
		onConnect: props.onConnect,
		onReconnect: (oldEdge, connection) => props.onReconnect(oldEdge, connection),
		onNodeClick: (_, node) => props.onSelect(node.id),
		onPaneClick: () => props.onSelect(null),
		onNodeDragStart: () => props.onDragNode(),
		onNodeDragStop: () => props.onMoveNode(),
		onPaneContextMenu: openPaneMenu,
		onNodeContextMenu: (event, node) => {
			event.preventDefault();
			props.onSelect(node.id);
			props.onNodeMenu({
				x: event.clientX,
				y: event.clientY
			}, node.id);
		},
		onEdgeContextMenu: (event, edge) => {
			event.preventDefault();
			props.onEdgeMenu({
				x: event.clientX,
				y: event.clientY
			}, edge.id);
		},
		deleteKeyCode: null,
		fitView: true,
		fitViewOptions: { padding: .25 },
		minZoom: .3,
		proOptions: { hideAttribution: false }
	}, /* @__PURE__ */ react.createElement(Background, {
		gap: 18,
		size: 1
	}), /* @__PURE__ */ react.createElement(Controls, { showInteractive: false })))));
}
function FlowCanvas(props) {
	return /* @__PURE__ */ react.createElement("div", { className: "wf-canvas" }, /* @__PURE__ */ react.createElement("style", null, style_default), /* @__PURE__ */ react.createElement("style", null, editorCss), /* @__PURE__ */ react.createElement(ReactFlowProvider, null, /* @__PURE__ */ react.createElement(CanvasFlow, props)));
}
//#endregion
//#region
function Field({ label, hint, tip, children }) {
	return /* @__PURE__ */ react.createElement("div", { className: "wf-field" }, /* @__PURE__ */ react.createElement("span", { className: "wf-label" }, label, tip !== void 0 && /* @__PURE__ */ react.createElement("span", {
		className: "wf-tip",
		title: tip,
		"aria-label": tip
	}, "i")), children, hint !== void 0 && /* @__PURE__ */ react.createElement("span", { className: "wf-hint" }, hint));
}
function Section({ title, children }) {
	return /* @__PURE__ */ react.createElement("section", { className: "wf-section" }, /* @__PURE__ */ react.createElement("div", { className: "wf-section-title" }, title), children);
}
var MODE_OPTIONS = [
	{
		value: "inline",
		label: "inline",
		title: "在同一个会话里派子 Agent 执行一个子任务"
	},
	{
		value: "subflow",
		label: "子图",
		title: "子图直接嵌在主图里，运行时 child 跑这段子图"
	},
	{
		value: "flowRef",
		label: "引用",
		title: "引用一张流程或一个子 Agent 配置；启动 run 时递归解析进快照"
	}
];
/** 空串 / 非正整数都按「不设」处理，避免把 NaN 写进 DSL */
function positiveInt(text) {
	if (text.trim() === "") return void 0;
	const value = Number(text);
	return Number.isInteger(value) && value >= 1 ? value : void 0;
}
function nodeLabel(node) {
	return `${node.data.title} · ${typeLabel(node.data.kind)}`;
}
/** 逗号/空白分隔的产物 key 列表 ↔ 输入框文本 */
function keysText(keys) {
	return (keys ?? []).join(", ");
}
function splitKeys(text) {
	const keys = text.split(/[,，\s]+/).map((key) => key.trim()).filter((key) => key !== "");
	return keys.length === 0 ? void 0 : keys;
}
/** 折叠头摘要只显示第一行，避免一段长文本把整行撑开 */
function firstLine(text, max = 18) {
	const line = text.trim().split("\n")[0]?.trim() ?? "";
	return line.length > max ? `${line.slice(0, max)}…` : line;
}
function orUndefined(text) {
	return text === void 0 || text === "" ? void 0 : text;
}
function Inspector(props) {
	const [tab, setTab] = react.useState("node");
	const [openGroups, setOpenGroups] = react.useState({});
	const { body } = props;
	const toggleGroup = (id) => {
		setOpenGroups((prev) => ({
			...prev,
			[id]: prev[id] !== true
		}));
	};
	const openGroup = (id) => {
		setOpenGroups((prev) => ({
			...prev,
			[id]: true
		}));
	};
	react.useEffect(() => {
		if (props.body !== void 0) setTab("node");
	}, [props.body?.id]);
	return /* @__PURE__ */ react.createElement("div", { className: "wf-insp-root" }, /* @__PURE__ */ react.createElement("div", {
		className: "wf-insp-tabs",
		role: "tablist",
		"aria-label": "属性面板"
	}, /* @__PURE__ */ react.createElement("button", {
		type: "button",
		role: "tab",
		className: "wf-tab",
		"data-active": tab === "node",
		"aria-selected": tab === "node",
		onClick: () => setTab("node")
	}, "节点"), /* @__PURE__ */ react.createElement("button", {
		type: "button",
		role: "tab",
		className: "wf-tab",
		"data-active": tab === "flow",
		"aria-selected": tab === "flow",
		onClick: () => setTab("flow")
	}, "图", props.agents.length > 0 ? ` · 角色 ${props.agents.length}` : "")), tab === "flow" ? /* @__PURE__ */ react.createElement("div", { className: "wf-insp-scroll" }, /* @__PURE__ */ react.createElement(FlowTab, {
		agents: props.agents,
		onAgentsChange: props.onAgentsChange
	})) : body === void 0 ? /* @__PURE__ */ react.createElement("div", { className: "wf-insp-scroll" }, /* @__PURE__ */ react.createElement(EmptyInspector, null)) : /* @__PURE__ */ react.createElement(NodePanel, {
		...props,
		body,
		issues: props.issues ?? [],
		openGroups,
		onToggleGroup: toggleGroup,
		onOpenGroup: openGroup
	}));
}
function EmptyInspector() {
	return /* @__PURE__ */ react.createElement("div", { className: "wf-insp-empty" }, /* @__PURE__ */ react.createElement("div", { className: "wf-insp-empty-title" }, "未选中节点"), /* @__PURE__ */ react.createElement("div", { className: "wf-hint" }, "点选画布上的节点编辑属性；从节点右侧圆点拖线到另一个节点即可连边。"), /* @__PURE__ */ react.createElement("div", { className: "wf-hint" }, "右键画布：在指针处新建 / 粘贴；右键节点：复制、设为入口、删除。"), /* @__PURE__ */ react.createElement("div", { className: "wf-hint" }, "快捷键：Ctrl+Z 撤销、Ctrl+Shift+Z 重做、Ctrl+S 保存、Delete 删除。"));
}
function NodePanel(props) {
	const { body } = props;
	const [copied, setCopied] = react.useState(false);
	const instrRef = react.useRef(null);
	const extraRef = react.useRef(null);
	const aggRef = react.useRef(null);
	const branchRef = react.useRef(null);
	const patch = (value) => props.onPatch(value);
	const multi = props.edges.length > 1;
	const options = body.type === "gate" ? body.options : [];
	/** 画布上先拉了线、还没归属任何选项的出边 */
	const loose = body.type === "gate" ? props.edges.filter((edge) => edge.data?.outlet === void 0) : [];
	const others = props.nodes.filter((node) => node.id !== body.id);
	const danglingRef = (id) => id !== void 0 && id !== "" && !props.nodes.some((node) => node.id === id) ? id : void 0;
	const chips = summarizeNode(body, {
		edgeCount: props.edges.length,
		flowNames: Object.fromEntries(props.flows.map((flow) => [flow.id, flow.name]))
	});
	const chipLabel = (key) => chips.find((chip) => chip.key === key)?.label;
	const profileFlows = props.flows.filter((flow) => flow.kind === "agent");
	const plainFlows = props.flows.filter((flow) => flow.kind !== "agent");
	const groupOpen = (id) => props.openGroups[id] === true;
	const toggleGroup = (id) => props.onToggleGroup(id);
	const openGroup = (group) => {
		props.onOpenGroup(group);
		window.requestAnimationFrame(() => {
			document.getElementById(`wf-grp-${group}`)?.scrollIntoView({ block: "nearest" });
		});
	};
	const onChip = (chip) => {
		if (chip.action === "open-subflow") {
			props.onOpenSubflow(body.id);
			return;
		}
		if (chip.group !== void 0) {
			openGroup(chip.group);
			return;
		}
		if (chip.key === "branches") branchRef.current?.scrollIntoView({ block: "nearest" });
	};
	const copyId = () => {
		const clipboard = typeof navigator === "undefined" ? void 0 : navigator.clipboard;
		if (clipboard === void 0) return;
		clipboard.writeText(body.id).then(() => {
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1200);
		}).catch(() => void 0);
	};
	const targetTitle = (id) => {
		const title = props.nodes.find((node) => node.id === id)?.data.title;
		return title === void 0 || title === "" ? id : title;
	};
	const reportSummary = body.type === "subagent" && body.reportHint !== void 0 && body.reportHint.trim() !== "" ? `汇报 ${firstLine(body.reportHint)}` : void 0;
	const contractSummary = orUndefined([chipLabel("artifacts"), reportSummary].filter(Boolean).join(" · "));
	return /* @__PURE__ */ react.createElement(react.Fragment, null, /* @__PURE__ */ react.createElement("div", { className: "wf-insp-head" }, /* @__PURE__ */ react.createElement("div", { className: "wf-insp-head-row" }, /* @__PURE__ */ react.createElement("span", {
		className: "wf-kind",
		"data-kind": body.type
	}, typeLabel(body.type)), /* @__PURE__ */ react.createElement("input", {
		className: "wf-insp-title",
		value: body.title ?? "",
		placeholder: body.id,
		"aria-label": "节点标题",
		onChange: (event) => patch({ title: event.target.value })
	}), props.isEntry && /* @__PURE__ */ react.createElement("span", { className: "wf-chip" }, "入口")), /* @__PURE__ */ react.createElement("div", { className: "wf-insp-head-row" }, /* @__PURE__ */ react.createElement("code", {
		className: "wf-id",
		title: body.id
	}, body.id), /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "wf-icon-btn",
		title: copied ? "已复制" : "复制节点 id",
		"aria-label": copied ? "已复制" : "复制节点 id",
		onClick: copyId
	}, copied ? "✓" : "⧉")), chips.length > 0 && /* @__PURE__ */ react.createElement("div", { className: "wf-chips" }, chips.map((chip) => {
		const interactive = chip.action !== void 0 || chip.group !== void 0 || chip.key === "branches" && body.type !== "gate";
		const content = /* @__PURE__ */ react.createElement("span", {
			className: "wf-sum-label",
			title: chip.label
		}, chip.label);
		if (!interactive) return /* @__PURE__ */ react.createElement("span", {
			className: "wf-sum-chip",
			key: chip.key
		}, content);
		return /* @__PURE__ */ react.createElement("button", {
			type: "button",
			className: "wf-sum-chip",
			"data-interactive": "true",
			key: chip.key,
			title: chip.action === "open-subflow" ? "打开子图" : "展开对应设置",
			onClick: () => onChip(chip)
		}, content);
	}))), /* @__PURE__ */ react.createElement("div", { className: "wf-insp-scroll" }, props.issues.length > 0 && /* @__PURE__ */ react.createElement(IssueList, { issues: props.issues }), body.type === "prompt" && /* @__PURE__ */ react.createElement("div", { className: "wf-core" }, /* @__PURE__ */ react.createElement(Field, {
		label: "指令",
		hint: "这一步要 Agent 做什么；支持 {{节点.payload.字段}} 插值"
	}, /* @__PURE__ */ react.createElement("textarea", {
		ref: instrRef,
		className: "wf-area",
		value: body.instruction ?? "",
		onChange: (event) => patch({ instruction: event.target.value }),
		placeholder: "例如：读 docs/README.md，列出必读文档"
	}), /* @__PURE__ */ react.createElement(InterpHints, {
		nodes: others,
		payloadFields: props.payloadFields,
		areaRef: instrRef
	}))), body.type === "tool" && /* @__PURE__ */ react.createElement("div", { className: "wf-core" }, /* @__PURE__ */ react.createElement(Field, {
		label: "工具名",
		hint: "例如 web_search、read"
	}, /* @__PURE__ */ react.createElement("input", {
		className: "wf-input",
		value: body.toolName ?? "",
		onChange: (event) => patch({ toolName: event.target.value })
	})), /* @__PURE__ */ react.createElement(Field, {
		label: "参数",
		hint: "键值对；会作为 view.tool.params 下发给 Agent"
	}, /* @__PURE__ */ react.createElement(ParamsEditor, {
		value: body.params,
		onChange: (params) => patch({ params })
	}))), body.type === "subagent" && /* @__PURE__ */ react.createElement("div", { className: "wf-core" }, body.mode === "inline" && /* @__PURE__ */ react.createElement(Field, {
		label: "附加指令",
		hint: "追加给子 Agent 的上下文；主指令来自上游节点"
	}, /* @__PURE__ */ react.createElement("textarea", {
		ref: extraRef,
		className: "wf-area",
		value: body.extraPrompt ?? "",
		onChange: (event) => patch({ extraPrompt: event.target.value }),
		placeholder: "例如：只读不写，产出不超过 20 行的结论"
	}), /* @__PURE__ */ react.createElement(InterpHints, {
		nodes: others,
		payloadFields: props.payloadFields,
		areaRef: extraRef
	})), /* @__PURE__ */ react.createElement(Field, {
		label: "执行方式",
		tip: "inline 同一会话执行；子图 内嵌可编辑子流程；引用 复用一张流程或子 Agent 配置"
	}, /* @__PURE__ */ react.createElement(Segmented, {
		ariaLabel: "子 Agent 执行方式",
		value: body.mode,
		options: MODE_OPTIONS,
		onChange: (mode) => {
			if (mode === body.mode) return;
			if (mode === "subflow" && body.subflow === void 0) {
				patch({
					mode,
					subflow: makeSubflow(`${body.title?.trim() || body.id} 子图`)
				});
				return;
			}
			patch({ mode });
		}
	}), body.mode === "subflow" && /* @__PURE__ */ react.createElement("div", { className: "wf-mode-row" }, /* @__PURE__ */ react.createElement("span", {
		className: "wf-hint",
		title: body.subflow === void 0 ? "尚未创建" : void 0
	}, body.subflow === void 0 ? "尚未创建" : `${body.subflow.nodes.length} 个节点 · 入口 ${body.subflow.entry}`), /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "wf-btn",
		onClick: () => props.onOpenSubflow(body.id)
	}, body.subflow === void 0 ? "创建子图并打开" : "打开子图")), body.mode === "flowRef" && /* @__PURE__ */ react.createElement("div", { className: "wf-field" }, /* @__PURE__ */ react.createElement("span", { className: "wf-label" }, "引用目标"), /* @__PURE__ */ react.createElement("select", {
		className: "wf-input",
		"aria-label": "引用目标",
		value: body.flowRef ?? "",
		onChange: (event) => patch({ flowRef: event.target.value === "" ? void 0 : event.target.value })
	}, /* @__PURE__ */ react.createElement("option", { value: "" }, "（选择流程或子 Agent 配置）"), profileFlows.length > 0 && /* @__PURE__ */ react.createElement("optgroup", { label: "子 Agent 配置" }, profileFlows.map((flow) => /* @__PURE__ */ react.createElement("option", {
		key: flow.id,
		value: flow.id
	}, flow.name, " · ", flow.id))), plainFlows.length > 0 && /* @__PURE__ */ react.createElement("optgroup", { label: "流程" }, plainFlows.map((flow) => /* @__PURE__ */ react.createElement("option", {
		key: flow.id,
		value: flow.id
	}, flow.name, " · ", flow.id))), body.flowRef !== void 0 && body.flowRef !== "" && !props.flows.some((flow) => flow.id === body.flowRef) && /* @__PURE__ */ react.createElement("option", { value: body.flowRef }, "（当前值 ", body.flowRef, "，不在列表）")), /* @__PURE__ */ react.createElement("span", { className: "wf-hint" }, "子 Agent 配置会连同它自己的角色表进入快照；目标必须已保存。")))), body.type === "gate" && /* @__PURE__ */ react.createElement("div", { className: "wf-core" }, /* @__PURE__ */ react.createElement(Field, {
		label: "问题",
		hint: "卡点会挂起 run，等人工答复后才继续"
	}, /* @__PURE__ */ react.createElement("textarea", {
		className: "wf-area",
		value: body.question ?? "",
		onChange: (event) => patch({ question: event.target.value }),
		placeholder: "例如：这次改动可以合并吗？"
	})), /* @__PURE__ */ react.createElement(Field, {
		label: "选项",
		hint: "每个选项就是一个出口；从卡片右侧的圆点拖线连接目标"
	}, options.map((option, index) => {
		const targets = props.edges.filter((edge) => edge.data?.outlet === option.id).map((edge) => edge.target);
		return /* @__PURE__ */ react.createElement("div", {
			className: "wf-opt-row",
			key: option.id
		}, /* @__PURE__ */ react.createElement("input", {
			className: "wf-input",
			value: option.label,
			onChange: (event) => {
				const next = options.map((entry, i) => i === index ? {
					...entry,
					label: event.target.value
				} : entry);
				patch({ options: next });
			}
		}), /* @__PURE__ */ react.createElement("span", {
			className: "wf-opt-target",
			"data-empty": targets.length === 0,
			title: targets.length === 0 ? "还没有连线" : targets.map((id) => `${targetTitle(id)} · ${id}`).join("\n")
		}, targets.length === 0 ? "未连接" : `→ ${targets.map(targetTitle).join("、")}`), /* @__PURE__ */ react.createElement("button", {
			type: "button",
			className: "wf-btn",
			onClick: () => patch({ options: options.filter((_, i) => i !== index) })
		}, "删"));
	}), loose.length > 0 && /* @__PURE__ */ react.createElement("div", { className: "wf-hint wf-hint-warn" }, "还有 ", loose.length, " 条出边没有绑定选项（", loose.map((edge) => `→ ${edge.target}`).join("、"), "）：从对应出口重连，保存时会按选项顺序兜底。"), /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "wf-btn",
		onClick: () => patch({ options: [...options, {
			id: nextOptionId(options),
			label: "新选项"
		}] })
	}, "+ 加选项"))), body.type === "join" && /* @__PURE__ */ react.createElement("div", { className: "wf-core" }, /* @__PURE__ */ react.createElement(Field, {
		label: "汇聚指令",
		hint: "所有上游完成后追加给 Agent 的汇总指令"
	}, /* @__PURE__ */ react.createElement("textarea", {
		ref: aggRef,
		className: "wf-area",
		value: body.aggregateInstruction ?? "",
		onChange: (event) => patch({ aggregateInstruction: event.target.value })
	}), /* @__PURE__ */ react.createElement(InterpHints, {
		nodes: others,
		payloadFields: props.payloadFields,
		areaRef: aggRef
	})), /* @__PURE__ */ react.createElement(Field, {
		label: "等待的节点",
		hint: "留空 = 等待本次 run 的全部子 run"
	}, /* @__PURE__ */ react.createElement("select", {
		className: "wf-input",
		value: body.waitFor ?? "",
		onChange: (event) => patch({ waitFor: event.target.value === "" ? void 0 : event.target.value })
	}, /* @__PURE__ */ react.createElement("option", { value: "" }, "（等待全部子 run）"), others.map((node) => /* @__PURE__ */ react.createElement("option", {
		key: node.id,
		value: node.id
	}, nodeLabel(node))), danglingRef(body.waitFor) !== void 0 && /* @__PURE__ */ react.createElement("option", { value: body.waitFor }, "（节点 ", body.waitFor, " 已不存在）")))), body.type === "end" && /* @__PURE__ */ react.createElement("div", { className: "wf-core" }, /* @__PURE__ */ react.createElement(Field, {
		label: "结果",
		hint: "success 正常结束；fail 判 run 失败但仍记录轨迹"
	}, /* @__PURE__ */ react.createElement(Segmented, {
		ariaLabel: "结束结果",
		value: body.outcome,
		options: [{
			value: "success",
			label: "success"
		}, {
			value: "fail",
			label: "fail"
		}],
		onChange: (outcome) => patch({ outcome })
	}))), /* @__PURE__ */ react.createElement("div", { className: "wf-adv" }, body.type === "subagent" && /* @__PURE__ */ react.createElement(react.Fragment, null, /* @__PURE__ */ react.createElement(Accordion, {
		id: "runtime",
		title: "角色与线程",
		summary: chipLabel("runtime"),
		open: groupOpen("runtime"),
		onToggle: () => toggleGroup("runtime")
	}, /* @__PURE__ */ react.createElement(Field, {
		label: "角色",
		tip: "引用全图角色表；角色章程与线程摘要会拼进 child preamble"
	}, /* @__PURE__ */ react.createElement("select", {
		className: "wf-input",
		value: body.role ?? "",
		onChange: (event) => patch({ role: event.target.value === "" ? void 0 : event.target.value })
	}, /* @__PURE__ */ react.createElement("option", { value: "" }, "（无角色）"), props.agents.map((agent) => /* @__PURE__ */ react.createElement("option", {
		key: agent.id,
		value: agent.id
	}, agent.name, " · ", agent.id)), body.role !== void 0 && !props.agents.some((agent) => agent.id === body.role) && /* @__PURE__ */ react.createElement("option", { value: body.role }, "（角色 ", body.role, " 不存在）"))), /* @__PURE__ */ react.createElement(Field, {
		label: "线程",
		tip: "留空或 new = 一次性；role = 同角色跨轮共享；也可以填自定义线程 key"
	}, /* @__PURE__ */ react.createElement("input", {
		className: "wf-input",
		value: body.thread ?? "",
		placeholder: "new / role / 自定义",
		onChange: (event) => {
			const value = event.target.value.trim();
			patch({ thread: value === "" ? void 0 : value });
		}
	}))), /* @__PURE__ */ react.createElement(Accordion, {
		id: "contract",
		title: "产物与汇报",
		summary: contractSummary,
		open: groupOpen("contract"),
		onToggle: () => toggleGroup("contract")
	}, /* @__PURE__ */ react.createElement(Field, {
		label: "产出 / 消费产物",
		tip: "逗号分隔的 key；只用于校验与面板，运行时以 complete_step.artifacts 为准"
	}, /* @__PURE__ */ react.createElement("div", { className: "wf-row" }, /* @__PURE__ */ react.createElement("input", {
		className: "wf-input",
		value: keysText(body.produces),
		placeholder: "produces: design",
		onChange: (event) => patch({ produces: splitKeys(event.target.value) })
	}), /* @__PURE__ */ react.createElement("input", {
		className: "wf-input",
		value: keysText(body.consumes),
		placeholder: "consumes: design",
		onChange: (event) => patch({ consumes: splitKeys(event.target.value) })
	}))), /* @__PURE__ */ react.createElement(Field, {
		label: "汇报格式",
		tip: "告诉子 Agent 的 payload/产物格式，会拼进 preamble"
	}, /* @__PURE__ */ react.createElement("textarea", {
		className: "wf-area",
		value: body.reportHint ?? "",
		onChange: (event) => patch({ reportHint: event.target.value }),
		placeholder: "例如：payload 带 verdict（pass/fail）、issues[]；产物 key=design"
	}))), /* @__PURE__ */ react.createElement(Accordion, {
		id: "fanout",
		title: "并行派发",
		summary: chipLabel("fanout"),
		open: groupOpen("fanout"),
		onToggle: () => toggleGroup("fanout")
	}, /* @__PURE__ */ react.createElement(Field, {
		label: "派发来源",
		tip: "插值表达式（解析成数组）；与下面的固定数量二选一。用 {{item}} 引用各条目"
	}, /* @__PURE__ */ react.createElement("input", {
		className: "wf-input",
		value: body.fanOut?.from ?? "",
		placeholder: "{{n2.payload.modules}}",
		onChange: (event) => patchFanOut(patch, body, { from: event.target.value })
	})), /* @__PURE__ */ react.createElement(Field, {
		label: "或固定数量 / 上限",
		tip: "max 截断超出项；被丢弃的条目会在派发轨迹里显式记录"
	}, /* @__PURE__ */ react.createElement("div", { className: "wf-row" }, /* @__PURE__ */ react.createElement("input", {
		className: "wf-input",
		type: "number",
		min: 1,
		placeholder: "数量",
		value: body.fanOut?.count ?? "",
		onChange: (event) => patchFanOut(patch, body, { count: positiveInt(event.target.value) })
	}), /* @__PURE__ */ react.createElement("input", {
		className: "wf-input",
		type: "number",
		min: 1,
		placeholder: "max 上限",
		value: body.fanOut?.max ?? "",
		onChange: (event) => patchFanOut(patch, body, { max: positiveInt(event.target.value) })
	}))))), body.type !== "end" && /* @__PURE__ */ react.createElement(Accordion, {
		id: "loop",
		title: "循环与逃生",
		summary: chipLabel("loop"),
		open: groupOpen("loop"),
		onToggle: () => toggleGroup("loop")
	}, /* @__PURE__ */ react.createElement("div", { className: "wf-grid2" }, /* @__PURE__ */ react.createElement(Field, {
		label: "回路 id",
		tip: "同一回路的节点共用一个 loopId；至少有一个节点配最大轮次当控制器"
	}, /* @__PURE__ */ react.createElement("input", {
		className: "wf-input",
		value: body.loopId ?? "",
		placeholder: "review-loop",
		onChange: (event) => patch({ loopId: event.target.value.trim() === "" ? void 0 : event.target.value.trim() })
	})), /* @__PURE__ */ react.createElement(Field, {
		label: "最大轮次",
		tip: "配在控制器节点上；控制器每执行一次算一轮，超限走 onLimitExceeded"
	}, /* @__PURE__ */ react.createElement("input", {
		className: "wf-input",
		type: "number",
		min: 1,
		value: body.maxRounds ?? "",
		onChange: (event) => patch({ maxRounds: positiveInt(event.target.value) })
	})), /* @__PURE__ */ react.createElement(Field, {
		label: "迭代上限",
		tip: "节点级兜底；环上节点建议设置，不设时只在全局步数上限处兜底"
	}, /* @__PURE__ */ react.createElement("input", {
		className: "wf-input",
		type: "number",
		min: 1,
		value: body.iterationLimit ?? "",
		onChange: (event) => patch({ iterationLimit: positiveInt(event.target.value) })
	})), /* @__PURE__ */ react.createElement(Field, {
		label: "撞上限后跳转",
		tip: "不设则撞上限直接判 run 失败；回路级上限优先用控制器上的出口"
	}, /* @__PURE__ */ react.createElement("select", {
		className: "wf-input",
		value: body.onLimitExceeded ?? "",
		onChange: (event) => patch({ onLimitExceeded: event.target.value === "" ? void 0 : event.target.value })
	}, /* @__PURE__ */ react.createElement("option", { value: "" }, "（不设，判失败）"), others.map((node) => /* @__PURE__ */ react.createElement("option", {
		key: node.id,
		value: node.id
	}, nodeLabel(node))), danglingRef(body.onLimitExceeded) !== void 0 && /* @__PURE__ */ react.createElement("option", { value: body.onLimitExceeded }, "（节点 ", body.onLimitExceeded, " 已不存在）"))))), body.type !== "prompt" && body.type !== "end" && (body.type !== "join" || (body.instruction ?? "").trim() !== "") && /* @__PURE__ */ react.createElement(Accordion, {
		id: "instruction",
		title: "本步指令",
		summary: orUndefined(body.instruction?.trim() === "" ? void 0 : firstLine(body.instruction ?? "")),
		open: groupOpen("instruction"),
		onToggle: () => toggleGroup("instruction")
	}, /* @__PURE__ */ react.createElement(Field, {
		label: "instruction（可选）",
		hint: body.type === "join" ? "汇聚步会用「汇聚指令」覆盖这里的值，通常不用填。" : void 0,
		tip: "会作为这一步的 instruction 下发给 Agent；不填则用该类型的默认说明"
	}, /* @__PURE__ */ react.createElement("textarea", {
		className: "wf-area",
		value: body.instruction ?? "",
		onChange: (event) => patch({ instruction: event.target.value })
	})))), body.type !== "gate" && multi && /* @__PURE__ */ react.createElement("div", { ref: branchRef }, /* @__PURE__ */ react.createElement(Section, { title: "分支" }, /* @__PURE__ */ react.createElement("div", { className: "wf-hint" }, "第一路填 * 表示默认分支；其余填自然语言条件，由 Agent 自行判断。"), props.edges.map((edge, index) => /* @__PURE__ */ react.createElement(Field, {
		key: edge.id,
		label: `第 ${index + 1} 路`,
		hint: `→ ${edge.target}`
	}, /* @__PURE__ */ react.createElement("input", {
		className: "wf-input",
		value: String(edge.data?.condition ?? (index === 0 ? "*" : "")),
		onChange: (event) => props.onCondition(edge.id, event.target.value),
		placeholder: index === 0 ? "默认分支一般填 *" : "例如：上一步结论为通过"
	}), /* @__PURE__ */ react.createElement("input", {
		className: "wf-input",
		value: String(edge.data?.when ?? ""),
		onChange: (event) => props.onWhen(edge.id, event.target.value),
		placeholder: "when（可选）：{{review.payload.verdict}} == 'pass'"
	})))))), /* @__PURE__ */ react.createElement("div", { className: "wf-insp-foot" }, props.isEntry ? /* @__PURE__ */ react.createElement("span", { className: "wf-chip" }, "当前入口") : /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "wf-btn",
		onClick: props.onSetEntry
	}, "设为入口"), /* @__PURE__ */ react.createElement("span", { className: "wf-spacer" }), /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "wf-btn",
		"data-danger": "true",
		onClick: props.onDelete
	}, "删除节点")));
}
function IssueList({ issues }) {
	const hasError = issues.some((issue) => issue.severity === "error");
	return /* @__PURE__ */ react.createElement("div", {
		className: "wf-issues",
		"data-has-error": hasError
	}, /* @__PURE__ */ react.createElement("div", { className: "wf-issues-head" }, hasError ? "✕" : "⚠", " ", issues.length, " 个问题"), issues.map((issue, index) => /* @__PURE__ */ react.createElement("div", {
		className: "wf-issue",
		"data-kind": issue.severity,
		key: `${issue.code}-${index}`
	}, /* @__PURE__ */ react.createElement("code", null, issue.code), /* @__PURE__ */ react.createElement("span", null, issue.message))));
}
function Segmented({ value, options, onChange, ariaLabel }) {
	return /* @__PURE__ */ react.createElement("div", {
		className: "wf-seg",
		role: "group",
		"aria-label": ariaLabel
	}, options.map((option) => /* @__PURE__ */ react.createElement("button", {
		key: option.value,
		type: "button",
		"data-active": option.value === value,
		title: option.title,
		"aria-pressed": option.value === value,
		onClick: () => {
			if (option.value !== value) onChange(option.value);
		}
	}, option.label)));
}
function Accordion({ id, title, summary, open, onToggle, children }) {
	return /* @__PURE__ */ react.createElement("section", {
		className: "wf-acc",
		id: `wf-grp-${id}`
	}, /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "wf-acc-head",
		"aria-expanded": open,
		onClick: onToggle
	}, /* @__PURE__ */ react.createElement("span", {
		className: "wf-acc-caret",
		"data-open": open
	}, "▸"), /* @__PURE__ */ react.createElement("span", { className: "wf-acc-title" }, title), summary !== void 0 && /* @__PURE__ */ react.createElement("span", {
		className: "wf-acc-summary",
		title: summary
	}, summary)), open && /* @__PURE__ */ react.createElement("div", { className: "wf-acc-body" }, children));
}
function FlowTab({ agents, onAgentsChange }) {
	return /* @__PURE__ */ react.createElement(Section, { title: `角色表（${agents.length}）` }, /* @__PURE__ */ react.createElement("div", { className: "wf-hint" }, "全图共享；子 Agent 节点用「角色」下拉引用。章程会随每轮 preamble 注入。"), agents.length === 0 && /* @__PURE__ */ react.createElement("div", { className: "wf-hint" }, "还没有角色。先加一个，节点里就能选它。"), agents.map((agent, index) => /* @__PURE__ */ react.createElement("div", {
		className: "wf-agent",
		key: index
	}, /* @__PURE__ */ react.createElement("div", { className: "wf-row" }, /* @__PURE__ */ react.createElement("input", {
		className: "wf-input",
		value: agent.id,
		placeholder: "id（字母/数字/下划线）",
		onChange: (event) => onAgentsChange(agents.map((item, i) => i === index ? {
			...item,
			id: event.target.value
		} : item))
	}), /* @__PURE__ */ react.createElement("input", {
		className: "wf-input",
		value: agent.name,
		placeholder: "显示名",
		onChange: (event) => onAgentsChange(agents.map((item, i) => i === index ? {
			...item,
			name: event.target.value
		} : item))
	}), /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "wf-btn",
		onClick: () => onAgentsChange(agents.filter((_, i) => i !== index))
	}, "删")), /* @__PURE__ */ react.createElement("textarea", {
		className: "wf-area",
		value: agent.charter,
		placeholder: "角色章程：职责、边界、完成标准",
		onChange: (event) => onAgentsChange(agents.map((item, i) => i === index ? {
			...item,
			charter: event.target.value
		} : item))
	}), /* @__PURE__ */ react.createElement("div", { className: "wf-row" }, /* @__PURE__ */ react.createElement("input", {
		className: "wf-input",
		value: keysText(agent.produces),
		placeholder: "produces: design",
		onChange: (event) => onAgentsChange(agents.map((item, i) => i === index ? {
			...item,
			produces: splitKeys(event.target.value)
		} : item))
	}), /* @__PURE__ */ react.createElement("input", {
		className: "wf-input",
		value: keysText(agent.consumes),
		placeholder: "consumes: design",
		onChange: (event) => onAgentsChange(agents.map((item, i) => i === index ? {
			...item,
			consumes: splitKeys(event.target.value)
		} : item))
	})))), /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "wf-btn",
		onClick: () => {
			let index = agents.length + 1;
			const used = new Set(agents.map((agent) => agent.id));
			while (used.has(`agent_${index}`)) index += 1;
			onAgentsChange([...agents, {
				id: `agent_${index}`,
				name: "新角色",
				charter: ""
			}]);
		}
	}, "+ 添加角色"));
}
/** 选项 id 要唯一：复用最小可用的 oN（删掉 o1 后再加不会撞 o2） */
function nextOptionId(options) {
	const used = new Set(options.map((option) => option.id));
	for (let index = 1; index < 1e3; index += 1) {
		const id = `o${index}`;
		if (!used.has(id)) return id;
	}
	return `o${Date.now().toString(36)}`;
}
/** fan-out 三字段互斥合并：改 from 就清 count，改 count 就清 from（校验器要求二选一） */
function patchFanOut(patch, body, change) {
	const next = { ...body.fanOut ?? {} };
	if (change.from !== void 0) delete next.count;
	if (change.count !== void 0) delete next.from;
	for (const [key, value] of Object.entries(change)) if (value === void 0 || value === "") delete next[key];
	else next[key] = value;
	patch({ fanOut: Object.keys(next).length === 0 ? void 0 : next });
}
/** 工具参数键值对编辑：不暴露整段 JSON；值能按 JSON 解析就用解析结果 */
function ParamsEditor({ value, onChange }) {
	const entries = Object.entries(value ?? {});
	const toText = (val) => typeof val === "string" ? val : JSON.stringify(val) ?? "";
	const parse = (text) => {
		try {
			return JSON.parse(text);
		} catch {
			return text;
		}
	};
	const write = (rows) => {
		const kept = rows.filter(([key]) => key.trim() !== "");
		onChange(kept.length === 0 ? void 0 : Object.fromEntries(kept));
	};
	return /* @__PURE__ */ react.createElement(react.Fragment, null, entries.map(([key, val], index) => /* @__PURE__ */ react.createElement("div", {
		className: "wf-row",
		key: index
	}, /* @__PURE__ */ react.createElement("input", {
		className: "wf-input",
		value: key,
		placeholder: "名称",
		onChange: (event) => write(entries.map(([k, v], i) => i === index ? [event.target.value, v] : [k, v]))
	}), /* @__PURE__ */ react.createElement("input", {
		className: "wf-input",
		value: toText(val),
		placeholder: "值",
		onChange: (event) => {
			const text = event.target.value;
			write(entries.map(([k, v], i) => i === index ? [k, parse(text)] : [k, v]));
		}
	}), /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "wf-btn",
		onClick: () => write(entries.filter((_, i) => i !== index))
	}, "✕"))), /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "wf-btn",
		onClick: () => write([...entries, [`param${entries.length + 1}`, ""]])
	}, "+ 加参数"));
}
/** 插值提示：其他节点 + 历史 run 学到的 payload 字段，点 chip 插到光标处 */
function InterpHints({ nodes, payloadFields, areaRef }) {
	if (nodes.length === 0) return null;
	const anyFields = nodes.some((node) => (payloadFields[node.id] ?? []).length > 0);
	return /* @__PURE__ */ react.createElement("details", { className: "wf-hints" }, /* @__PURE__ */ react.createElement("summary", null, "插值提示（引用之前节点的结果）"), !anyFields && /* @__PURE__ */ react.createElement("div", { className: "wf-hint" }, "这张图跑过一次后，这里会按节点提示 payload 的字段。"), nodes.map((node) => {
		const fields = payloadFields[node.id] ?? [];
		if (fields.length === 0) return null;
		return /* @__PURE__ */ react.createElement("div", {
			className: "wf-hints-node",
			key: node.id
		}, /* @__PURE__ */ react.createElement("span", { className: "wf-hints-name" }, node.data.title, " ", /* @__PURE__ */ react.createElement("code", null, node.id)), /* @__PURE__ */ react.createElement("span", { className: "wf-hints-chips" }, fields.map((field) => /* @__PURE__ */ react.createElement("button", {
			type: "button",
			className: "wf-hints-chip",
			key: field,
			title: "插入到光标处",
			onClick: () => insertToken(areaRef.current, `{{${node.id}.payload.${field}}}`)
		}, `{{${node.id}.payload.${field}}}`))));
	}));
}
/** 往受控 textarea 的光标处插 token 后把光标放到 token 后面 */
function insertToken(area, token) {
	if (area === null) return;
	const start = area.selectionStart ?? area.value.length;
	const end = area.selectionEnd ?? start;
	const next = area.value.slice(0, start) + token + area.value.slice(end);
	const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
	if (setter !== void 0) setter.call(area, next);
	area.dispatchEvent(new Event("input", { bubbles: true }));
	const caret = start + token.length;
	area.focus();
	area.setSelectionRange(caret, caret);
}
//#endregion
//#region
function ContextMenu(props) {
	const rootRef = react.useRef(null);
	const [pos, setPos] = react.useState({
		left: props.x,
		top: props.y
	});
	const [openSub, setOpenSub] = react.useState(null);
	react.useLayoutEffect(() => {
		const element = rootRef.current;
		if (element === null) return;
		const rect = element.getBoundingClientRect();
		const left = Math.max(8, Math.min(props.x, window.innerWidth - rect.width - 8));
		const top = Math.max(8, Math.min(props.y, window.innerHeight - rect.height - 8));
		setPos({
			left,
			top
		});
	}, [
		props.x,
		props.y,
		props.items.length
	]);
	react.useEffect(() => {
		const onPointerDown = (event) => {
			const element = rootRef.current;
			if (element !== null && event.target instanceof Node && element.contains(event.target)) return;
			props.onClose();
		};
		const onKeyDown = (event) => {
			if (event.key === "Escape") {
				event.preventDefault();
				props.onClose();
			}
		};
		const onBlur = () => props.onClose();
		window.addEventListener("pointerdown", onPointerDown);
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("blur", onBlur);
		window.addEventListener("resize", onBlur);
		return () => {
			window.removeEventListener("pointerdown", onPointerDown);
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("blur", onBlur);
			window.removeEventListener("resize", onBlur);
		};
	}, [props.onClose]);
	const pick = (item) => {
		if (item.disabled === true || item.children !== void 0) return;
		props.onClose();
		item.onSelect?.();
	};
	return /* @__PURE__ */ react.createElement("div", {
		ref: rootRef,
		className: "wf-menu",
		role: "menu",
		style: {
			left: pos.left,
			top: pos.top
		},
		onPointerDown: (event) => event.stopPropagation(),
		onContextMenu: (event) => event.preventDefault()
	}, props.heading !== void 0 && /* @__PURE__ */ react.createElement("div", { className: "wf-menu-head" }, props.heading), props.items.map((item) => item.children === void 0 ? /* @__PURE__ */ react.createElement("button", {
		key: item.id,
		type: "button",
		role: "menuitem",
		className: "wf-menu-item",
		"data-danger": item.danger === true ? "true" : "false",
		disabled: item.disabled === true,
		onClick: () => pick(item)
	}, /* @__PURE__ */ react.createElement("span", { className: "wf-menu-label" }, item.label), item.hint !== void 0 && /* @__PURE__ */ react.createElement("span", { className: "wf-menu-hint" }, item.hint)) : /* @__PURE__ */ react.createElement("div", {
		key: item.id,
		className: "wf-menu-group",
		onMouseEnter: () => setOpenSub(item.id),
		onMouseLeave: () => setOpenSub((current) => current === item.id ? null : current)
	}, /* @__PURE__ */ react.createElement("button", {
		type: "button",
		role: "menuitem",
		"aria-haspopup": "menu",
		"aria-expanded": openSub === item.id,
		className: "wf-menu-item",
		disabled: item.disabled === true,
		onClick: () => setOpenSub((current) => current === item.id ? null : item.id),
		onKeyDown: (event) => {
			if (event.key === "ArrowRight") {
				event.preventDefault();
				setOpenSub(item.id);
			} else if (event.key === "ArrowLeft") {
				event.preventDefault();
				setOpenSub(null);
			}
		}
	}, /* @__PURE__ */ react.createElement("span", { className: "wf-menu-label" }, item.label), item.hint !== void 0 && /* @__PURE__ */ react.createElement("span", { className: "wf-menu-hint" }, item.hint), /* @__PURE__ */ react.createElement("span", {
		className: "wf-menu-caret",
		"aria-hidden": "true"
	}, "›")), openSub === item.id && /* @__PURE__ */ react.createElement(SubMenu, {
		items: item.children,
		onPick: pick
	}))));
}
/** 子菜单：默认贴父项右侧，靠右边缘时翻到左侧 */
function SubMenu({ items, onPick }) {
	const ref = react.useRef(null);
	const [side, setSide] = react.useState("right");
	const [top, setTop] = react.useState(-5);
	react.useLayoutEffect(() => {
		const element = ref.current;
		if (element === null) return;
		const rect = element.getBoundingClientRect();
		if (rect.right > window.innerWidth - 8) setSide("left");
		const overflowBottom = rect.bottom - (window.innerHeight - 8);
		if (overflowBottom > 0) setTop(-5 - overflowBottom);
	}, []);
	return /* @__PURE__ */ react.createElement("div", {
		ref,
		className: "wf-menu wf-submenu",
		"data-side": side,
		style: { top },
		role: "menu"
	}, items.map((item) => /* @__PURE__ */ react.createElement("button", {
		key: item.id,
		type: "button",
		role: "menuitem",
		className: "wf-menu-item",
		"data-danger": item.danger === true ? "true" : "false",
		disabled: item.disabled === true,
		onClick: () => onPick(item)
	}, /* @__PURE__ */ react.createElement("span", { className: "wf-menu-label" }, item.label), item.hint !== void 0 && /* @__PURE__ */ react.createElement("span", { className: "wf-menu-hint" }, item.hint))));
}
//#endregion
//#region
var PAGE_STYLE$1 = {
	background: "var(--dsw-alias-bg-base, Canvas)",
	color: "var(--dsw-alias-label-primary, CanvasText)",
	minHeight: 420,
	height: "100%",
	overflow: "auto"
};
var HISTORY_LIMIT = 50;
/** 同一个输入框连续敲字合并成一步撤销 */
var MERGE_WINDOW_MS = 900;
/** 右侧属性面板宽度：拖动分隔条调整，双击复位 */
var INSPECTOR_MIN = 240;
var INSPECTOR_MAX = 640;
var INSPECTOR_DEFAULT = 312;
/** 拖到最宽时也要给画布留出的最小宽度 */
var CANVAS_MIN = 280;
var INSPECTOR_WIDTH_KEY = "aiworkflow.editor.inspectorWidth";
function clampInspectorWidth(value, max = INSPECTOR_MAX) {
	return Math.min(Math.max(INSPECTOR_MIN, Math.round(value)), Math.max(INSPECTOR_MIN, max));
}
function readInspectorWidth() {
	try {
		const raw = window.localStorage.getItem(INSPECTOR_WIDTH_KEY);
		const value = raw === null ? NaN : Number(raw);
		return Number.isFinite(value) ? clampInspectorWidth(value) : INSPECTOR_DEFAULT;
	} catch {
		return INSPECTOR_DEFAULT;
	}
}
function WorkflowPage({ onExit } = {}) {
	const [flows, setFlows] = react.useState(null);
	const [error, setError] = react.useState(null);
	const [doc, setDoc] = react.useState(null);
	const [busy, setBusy] = react.useState(false);
	const [libraryTab, setLibraryTab] = react.useState("flow");
	const refresh = react.useCallback(async () => {
		setError(null);
		try {
			setFlows(await listFlows());
		} catch (cause) {
			setError(errorText$2(cause));
			setFlows([]);
		}
	}, []);
	react.useEffect(() => {
		refresh();
	}, [refresh]);
	react.useEffect(() => {
		reportInfo("可视化工作流页已挂载");
	}, []);
	const open = async (id) => {
		setBusy(true);
		setError(null);
		try {
			setDoc(await getFlow(id));
		} catch (cause) {
			setError(errorText$2(cause));
		} finally {
			setBusy(false);
		}
	};
	const create = (kind) => {
		const start = makeNode("prompt", "n1");
		start.title = "开始";
		start.next = "n2";
		const flow = {
			id: `${kind === "agent" ? "agent" : "flow"}-${Date.now().toString(36)}`,
			name: kind === "agent" ? "未命名子 Agent" : "未命名流程",
			kind,
			entry: "n1",
			nodes: [start, makeNode("end", "n2")],
			_ui: { positions: {
				n1: {
					x: 80,
					y: 120
				},
				n2: {
					x: 420,
					y: 120
				}
			} }
		};
		if (kind === "agent") flow.agents = [{
			id: "agent_1",
			name: "子 Agent",
			charter: "按当前步骤完成任务并回报。"
		}];
		setDoc(flow);
	};
	const remove = async (id, label, kind) => {
		const what = kind === "agent" ? "子 Agent 配置" : "流程";
		const refs = kind === "agent" ? "\n如果有主流程还在引用它，删除后那些流程启动 run 会失败。" : "";
		if (!window.confirm(`删除${what}「${label}」（${id}）？删除后不可恢复。${refs}`)) return;
		try {
			await deleteFlow(id);
			await refresh();
		} catch (cause) {
			setError(errorText$2(cause));
		}
	};
	if (doc !== null) return /* @__PURE__ */ react.createElement(Editor, {
		key: doc.id,
		initial: doc,
		flows: flows ?? [],
		onExit,
		onBack: () => {
			setDoc(null);
			refresh();
		}
	});
	const all = flows ?? [];
	const flowCount = all.filter((item) => (item.kind ?? "flow") === "flow").length;
	const agentCount = all.length - flowCount;
	const shown = all.filter((item) => (item.kind ?? "flow") === libraryTab);
	return /* @__PURE__ */ react.createElement("div", {
		className: "wf-page",
		style: PAGE_STYLE$1
	}, /* @__PURE__ */ react.createElement("style", null, editorCss), /* @__PURE__ */ react.createElement("header", { className: "wf-head" }, /* @__PURE__ */ react.createElement("span", { className: "wf-title" }, "可视化工作流"), /* @__PURE__ */ react.createElement("div", {
		className: "wf-lib-tabs",
		role: "tablist",
		"aria-label": "流程库类型"
	}, /* @__PURE__ */ react.createElement("button", {
		type: "button",
		role: "tab",
		className: "wf-lib-tab",
		"data-active": libraryTab === "flow",
		"aria-selected": libraryTab === "flow",
		onClick: () => setLibraryTab("flow")
	}, "流程 ", flowCount), /* @__PURE__ */ react.createElement("button", {
		type: "button",
		role: "tab",
		className: "wf-lib-tab",
		"data-active": libraryTab === "agent",
		"aria-selected": libraryTab === "agent",
		onClick: () => setLibraryTab("agent")
	}, "子 Agent 配置 ", agentCount)), /* @__PURE__ */ react.createElement("span", { className: "wf-spacer" }), /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "wf-btn",
		onClick: () => void refresh(),
		disabled: busy
	}, "刷新"), /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "wf-btn",
		"data-primary": "true",
		onClick: () => create(libraryTab)
	}, libraryTab === "agent" ? "新建子 Agent" : "新建流程"), onExit !== void 0 && /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "wf-btn",
		onClick: onExit
	}, "返回会话")), error !== null && /* @__PURE__ */ react.createElement("div", {
		className: "wf-banner",
		"data-kind": "error"
	}, error), /* @__PURE__ */ react.createElement("div", { className: "wf-list" }, flows === null && /* @__PURE__ */ react.createElement("div", { className: "wf-empty" }, /* @__PURE__ */ react.createElement("b", null, "加载中…")), flows !== null && shown.length === 0 && /* @__PURE__ */ react.createElement("div", { className: "wf-empty" }, /* @__PURE__ */ react.createElement("b", null, libraryTab === "agent" ? "还没有子 Agent 配置" : "还没有工作流"), /* @__PURE__ */ react.createElement("span", null, libraryTab === "agent" ? "把可复用的子 Agent 角色和子图存到这里，主流程用「引用」节点调用。" : "新建一张，从「指令 → 结束」开始。")), shown.map((flow) => /* @__PURE__ */ react.createElement("div", {
		className: "wf-item",
		key: flow.id,
		onClick: () => void open(flow.id),
		role: "button",
		tabIndex: 0
	}, /* @__PURE__ */ react.createElement("div", { style: {
		flex: 1,
		minWidth: 0
	} }, /* @__PURE__ */ react.createElement("div", { className: "wf-item-name" }, flow.name), /* @__PURE__ */ react.createElement("div", { className: "wf-item-meta" }, flow.id, " · ", relTime(flow.updatedAt))), /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "wf-btn",
		onClick: (event) => {
			event.stopPropagation();
			remove(flow.id, flow.name, flow.kind ?? "flow");
		}
	}, "删除")))));
}
function Editor({ initial, flows, onBack, onExit }) {
	const seed = react.useMemo(() => canvasOf(initial), [initial]);
	const [nodes, setNodes, onNodesChange] = useNodesState(seed.nodes);
	const [edges, setEdges, onEdgesChange] = useEdgesState(seed.edges);
	const [bodies, setBodies] = react.useState(() => Object.fromEntries(initial.nodes.map((node) => [node.id, node])));
	const [agents, setAgents] = react.useState(initial.agents ?? []);
	const [name, setName] = react.useState(initial.name);
	const [entry, setEntry] = react.useState(initial.entry);
	const [dirty, setDirty] = react.useState(false);
	const [selectedId, setSelectedId] = react.useState(null);
	const [busy, setBusy] = react.useState(false);
	const [banner, setBanner] = react.useState(null);
	const [menu, setMenu] = react.useState(null);
	const [clipboard, setClipboard] = react.useState(null);
	const [history, setHistory] = react.useState({
		past: [],
		future: []
	});
	/** 干跑校验结果（防抖 350ms，与保存共用同一个校验器） */
	const [validation, setValidation] = react.useState(null);
	const [valOpen, setValOpen] = react.useState(false);
	/** 历史 run 学到的 payload 字段名（插值提示用） */
	const [payloadFields$1, setPayloadFields] = react.useState({});
	/** 右侧属性面板宽度：可拖动分隔条调整，记到 localStorage */
	const [inspectorWidth, setInspectorWidth] = react.useState(readInspectorWidth);
	const [resizing, setResizing] = react.useState(false);
	/** 点出口名字后待连线的来源：再点一个目标节点就把它连上 */
	const [pendingLink, setPendingLink] = react.useState(null);
	/** 内嵌子图编辑栈：空 = 主图，非空 = 正在编辑最内层子图 */
	const [frames, setFrames] = react.useState([]);
	const pageRef = react.useRef(null);
	const bodyRef = react.useRef(null);
	/** 拖动分隔条时的起点，避免每帧读 state */
	const resizeRef = react.useRef(null);
	const baseRef = react.useRef(initial);
	const canvasApiRef = react.useRef(null);
	const clipboardRef = react.useRef(null);
	const addSeq = react.useRef(0);
	/** 本次会话已经发过的 id：连续点击 / 撤销后再删时不会把同一个 id 发两次 */
	const issuedRef = react.useRef(/* @__PURE__ */ new Set());
	/** 同一个 mergeKey 的连续编辑只压一次历史 */
	const mergeRef = react.useRef(null);
	const historyRef = react.useRef(history);
	const selectedRef = react.useRef(null);
	const saveRef = react.useRef(null);
	/** 上次保存/加载时的图签名：dirty 由"当前 composeRoot 签名 ≠ 基线"派生，撤销回原样后能自动归零 */
	const savedSignatureRef = react.useRef(null);
	/** frames 的同步副本：composeRoot 等事件处理里立刻要读，不等下一次 render */
	const framesRef = react.useRef([]);
	const liveRef = react.useRef({
		nodes: seed.nodes,
		edges: seed.edges,
		bodies,
		agents,
		entry: initial.entry,
		name: initial.name
	});
	liveRef.current = {
		nodes,
		edges,
		bodies,
		agents,
		entry,
		name
	};
	historyRef.current = history;
	selectedRef.current = selectedId;
	clipboardRef.current = clipboard;
	framesRef.current = frames;
	const record = react.useCallback((mergeKey) => {
		const now = Date.now();
		const last = mergeRef.current;
		if (mergeKey !== void 0 && last !== null && last.key === mergeKey && now - last.at < MERGE_WINDOW_MS) {
			last.at = now;
			return;
		}
		mergeRef.current = mergeKey === void 0 ? null : {
			key: mergeKey,
			at: now
		};
		setHistory((current) => ({
			past: [...current.past.slice(-49), liveRef.current],
			future: []
		}));
		setDirty(true);
	}, []);
	const restore = react.useCallback((snapshot) => {
		setNodes(withEntryFlags(snapshot.nodes, snapshot.entry));
		setEdges(snapshot.edges);
		setBodies(snapshot.bodies);
		setAgents(snapshot.agents);
		setEntry(snapshot.entry);
		setName(snapshot.name);
		setSelectedId((current) => current !== null && snapshot.nodes.some((node) => node.id === current) ? current : null);
		mergeRef.current = null;
	}, [setNodes, setEdges]);
	/** 切换当前编辑的画布（主图 / 子图）：整份状态换掉，不走进度历史 */
	const loadGraph = react.useCallback((flow) => {
		const canvas = canvasOf(flow);
		setNodes(withEntryFlags(canvas.nodes, flow.entry));
		setEdges(canvas.edges);
		setBodies(Object.fromEntries(flow.nodes.map((node) => [node.id, node])));
		setAgents(flow.agents ?? []);
		setName(flow.name);
		setEntry(flow.entry);
		setSelectedId(null);
		setPendingLink(null);
		setHistory({
			past: [],
			future: []
		});
		setValidation(null);
		mergeRef.current = null;
		baseRef.current = flow;
		window.setTimeout(() => canvasApiRef.current?.fitAll?.(), 40);
	}, [setNodes, setEdges]);
	/** 把当前正在编辑的层（可能是最内层子图）折回主图，得到可保存/校验的根 Flow */
	const composeRoot = react.useCallback(() => {
		const snapshot = liveRef.current;
		const currentAgents = snapshot.agents;
		let flow = buildFlow({
			...baseRef.current,
			name: snapshot.name,
			entry: snapshot.entry,
			agents: currentAgents
		}, snapshot.bodies, snapshot.nodes, snapshot.edges);
		const stack = framesRef.current;
		for (let index = stack.length - 1; index >= 0; index -= 1) {
			const frame = stack[index];
			if (frame === void 0) throw new Error("子图栈损坏：帧缺失");
			const owner = frame.snapshot.bodies[frame.parentNodeId];
			if (owner === void 0 || owner.type !== "subagent") throw new Error(`子图栈损坏：父节点 ${frame.parentNodeId} 不是 subagent`);
			const subagent = owner;
			const updated = {
				...subagent,
				mode: "subflow",
				subflow: {
					name: flow.name,
					entry: flow.entry,
					maxSteps: subagent.subflow?.maxSteps,
					nodes: flow.nodes,
					_ui: flow._ui
				}
			};
			const parentSnapshot = {
				...frame.snapshot,
				bodies: {
					...frame.snapshot.bodies,
					[frame.parentNodeId]: updated
				},
				agents: currentAgents
			};
			flow = buildFlow({
				...frame.base,
				name: parentSnapshot.name,
				entry: parentSnapshot.entry,
				agents: parentSnapshot.agents
			}, parentSnapshot.bodies, parentSnapshot.nodes, parentSnapshot.edges);
		}
		return flow;
	}, []);
	/** 脏标记 = 当前根图签名 ≠ 上次保存/加载时的签名。
	*  比每个交互手动 setDirty 更可靠：撤销回原样、切换子图层、无改动返回父层都不会误报。 */
	react.useEffect(() => {
		let signature;
		try {
			signature = JSON.stringify(composeRoot());
		} catch {
			return;
		}
		if (savedSignatureRef.current === null) {
			savedSignatureRef.current = signature;
			setDirty(false);
			return;
		}
		setDirty(signature !== savedSignatureRef.current);
	}, [
		composeRoot,
		nodes,
		edges,
		bodies,
		agents,
		entry,
		name,
		frames
	]);
	/** 进入某个 subagent 节点的内嵌子图；没有子图时先建一张最小合法子图 */
	const openSubflow = react.useCallback((nodeId) => {
		const snapshot = liveRef.current;
		const body = snapshot.bodies[nodeId];
		if (body === void 0 || body.type !== "subagent") return;
		const created = body.subflow === void 0;
		const subagent = created ? {
			...body,
			mode: "subflow",
			subflow: makeSubflow(`${body.title?.trim() || body.id} 子图`)
		} : {
			...body,
			mode: "subflow"
		};
		const sub = subagent.subflow;
		if (sub === void 0) return;
		const nextBodies = {
			...snapshot.bodies,
			[nodeId]: subagent
		};
		const nextSnapshot = {
			...snapshot,
			bodies: nextBodies
		};
		const subFlow = {
			id: `${baseRef.current.id}::${nodeId}`,
			name: sub.name ?? `${body.title?.trim() || nodeId} 子图`,
			entry: sub.entry,
			maxSteps: sub.maxSteps,
			nodes: sub.nodes,
			agents: snapshot.agents,
			_ui: sub._ui
		};
		const frame = {
			parentNodeId: nodeId,
			title: body.title?.trim() || nodeId,
			snapshot: nextSnapshot,
			base: baseRef.current,
			history: historyRef.current
		};
		const nextFrames = [...framesRef.current, frame];
		framesRef.current = nextFrames;
		setFrames(nextFrames);
		loadGraph(subFlow);
		if (created) setDirty(true);
	}, [loadGraph]);
	/** 从当前子图返回上一层：把子图写回父节点的 subflow，再恢复父图状态 */
	const backToParent = react.useCallback(() => {
		const frame = framesRef.current[framesRef.current.length - 1];
		if (frame === void 0) return;
		const snapshot = liveRef.current;
		const built = buildFlow({
			...baseRef.current,
			name: snapshot.name,
			entry: snapshot.entry,
			agents: snapshot.agents
		}, snapshot.bodies, snapshot.nodes, snapshot.edges);
		const owner = frame.snapshot.bodies[frame.parentNodeId];
		if (owner === void 0 || owner.type !== "subagent") return;
		const subagent = {
			...owner,
			mode: "subflow",
			subflow: {
				name: built.name,
				entry: built.entry,
				maxSteps: owner.subflow?.maxSteps,
				nodes: built.nodes,
				_ui: built._ui
			}
		};
		const nextBodies = {
			...frame.snapshot.bodies,
			[frame.parentNodeId]: subagent
		};
		const parentFlow = buildFlow({
			...frame.base,
			name: frame.snapshot.name,
			entry: frame.snapshot.entry,
			agents: snapshot.agents
		}, nextBodies, frame.snapshot.nodes, frame.snapshot.edges);
		const changed = JSON.stringify({
			name: owner.subflow?.name,
			entry: owner.subflow?.entry,
			nodes: owner.subflow?.nodes,
			_ui: owner.subflow?._ui
		}) !== JSON.stringify({
			name: built.name,
			entry: built.entry,
			nodes: built.nodes,
			_ui: built._ui
		});
		const nextFrames = framesRef.current.slice(0, -1);
		framesRef.current = nextFrames;
		setFrames(nextFrames);
		loadGraph(parentFlow);
		setHistory(changed ? {
			past: [...frame.history.past.slice(-49), frame.snapshot],
			future: []
		} : frame.history);
	}, [loadGraph]);
	const undo = react.useCallback(() => {
		const { past, future } = historyRef.current;
		const previous = past[past.length - 1];
		if (previous === void 0) return;
		setHistory({
			past: past.slice(0, -1),
			future: [liveRef.current, ...future].slice(0, HISTORY_LIMIT)
		});
		restore(previous);
	}, [restore]);
	const redo = react.useCallback(() => {
		const { past, future } = historyRef.current;
		const next = future[0];
		if (next === void 0) return;
		setHistory({
			past: [...past.slice(-49), liveRef.current],
			future: future.slice(1)
		});
		restore(next);
	}, [restore]);
	/** 删节点/删边一次算完：bodies、入口、选中一起收拾，只写一次历史 */
	const removeGraph = react.useCallback((nodeIds, edgeIds) => {
		if (nodeIds.length === 0 && edgeIds.length === 0) return;
		const deadNodes = new Set(nodeIds);
		const deadEdges = new Set(edgeIds);
		const snapshot = liveRef.current;
		const keptNodes = snapshot.nodes.filter((node) => !deadNodes.has(node.id));
		const keptEdges = snapshot.edges.filter((edge) => !deadEdges.has(edge.id) && !deadNodes.has(edge.source) && !deadNodes.has(edge.target));
		const nextBodies = {};
		for (const [id, body] of Object.entries(snapshot.bodies)) if (!deadNodes.has(id)) nextBodies[id] = body;
		const nextEntry = deadNodes.has(snapshot.entry) ? keptNodes[0]?.id ?? "" : snapshot.entry;
		setNodes(withEntryFlags(keptNodes, nextEntry));
		setEdges(keptEdges);
		setBodies(nextBodies);
		setEntry(nextEntry);
		setSelectedId((current) => current !== null && deadNodes.has(current) ? null : current);
		mergeRef.current = null;
		setDirty(true);
	}, [setNodes, setEdges]);
	const deleteSelected = react.useCallback(() => {
		const snapshot = liveRef.current;
		const nodeIds = snapshot.nodes.filter((node) => node.selected === true).map((node) => node.id);
		const deadNodes = new Set(nodeIds);
		const edgeIds = snapshot.edges.filter((edge) => edge.selected === true && !deadNodes.has(edge.source) && !deadNodes.has(edge.target)).map((edge) => edge.id);
		if (nodeIds.length === 0 && edgeIds.length === 0) return;
		record();
		removeGraph(nodeIds, edgeIds);
	}, [record, removeGraph]);
	const deleteNodeById = react.useCallback((id) => {
		if (!liveRef.current.nodes.some((node) => node.id === id)) return;
		record();
		removeGraph([id], []);
	}, [record, removeGraph]);
	const deleteEdgeById = react.useCallback((id) => {
		if (!liveRef.current.edges.some((edge) => edge.id === id)) return;
		record();
		removeGraph([], [id]);
	}, [record, removeGraph]);
	const setEntryId = react.useCallback((id) => {
		record();
		setEntry(id);
		setNodes((all) => withEntryFlags(all, id));
		if (liveRef.current.edges.some((edge) => edge.target === id)) {
			setEdges((all) => all.filter((edge) => edge.target !== id));
			reportInfo("已删除指向新入口的入线（入口不能有入边）");
		}
	}, [
		record,
		setNodes,
		setEdges
	]);
	const placePoint = react.useCallback((at) => {
		if (at !== void 0) return {
			x: Math.round(at.x),
			y: Math.round(at.y)
		};
		const center = canvasApiRef.current?.center() ?? {
			x: 140,
			y: 140
		};
		const step = addSeq.current % 6;
		addSeq.current += 1;
		return {
			x: Math.round(center.x - 70 + step * 22),
			y: Math.round(center.y - 28 + step * 20)
		};
	}, []);
	const insertNode = react.useCallback((body, title, at) => {
		const id = body.id;
		const position = placePoint(at);
		setBodies((all) => ({
			...all,
			[id]: body
		}));
		setNodes((all) => [...all.map((node) => node.selected === true ? {
			...node,
			selected: false
		} : node), {
			id,
			type: "wf",
			position,
			selected: true,
			data: {
				title,
				kind: body.type,
				detail: detailOf(body),
				isEntry: false,
				outlets: outletsOf(body)
			}
		}]);
		setSelectedId(id);
		setDirty(true);
	}, [placePoint, setNodes]);
	const addNode = react.useCallback((type, at) => {
		record();
		const id = nextNodeId(liveRef.current.nodes, issuedRef.current);
		issuedRef.current.add(id);
		const body = makeNode(type, id);
		insertNode(body, body.title ?? typeLabel(type), at);
	}, [record, insertNode]);
	/** 插入一个“子 Agent + 完成节点”的模板；子图内部回路随主图保存 */
	const insertTemplate = react.useCallback((kind, at) => {
		const template = TEMPLATES.find((item) => item.kind === kind);
		if (template === void 0) return;
		record();
		const snapshot = liveRef.current;
		const subId = nextNodeId(snapshot.nodes, issuedRef.current);
		issuedRef.current.add(subId);
		const endId = nextNodeId(snapshot.nodes, issuedRef.current);
		issuedRef.current.add(endId);
		const position = placePoint(at);
		const subflow = template.subflow();
		const body = {
			id: subId,
			type: "subagent",
			title: template.title,
			extraPrompt: template.extraPrompt,
			mode: "subflow",
			subflow,
			reportHint: template.reportHint,
			produces: [template.produces]
		};
		const end = makeNode("end", endId);
		end.title = `${template.title} · 完成`;
		const nextEntry = snapshot.nodes.length === 0 || snapshot.entry === "" ? subId : snapshot.entry;
		const card = (node, x) => ({
			id: node.id,
			type: "wf",
			position: {
				x: position.x + x,
				y: position.y
			},
			data: {
				title: node.title?.trim() || node.id,
				kind: node.type,
				detail: detailOf(node),
				isEntry: node.id === nextEntry,
				outlets: outletsOf(node),
				...node.type === "subagent" && node.mode === "subflow" && node.subflow !== void 0 ? { subflow: subflowPreview(node.subflow) } : {}
			}
		});
		setBodies((all) => ({
			...all,
			[subId]: body,
			[endId]: end
		}));
		setNodes((all) => [
			...all.map((node) => node.selected === true ? {
				...node,
				selected: false
			} : node),
			card(body, 0),
			card(end, 300)
		]);
		setEdges((all) => [...all, {
			id: newEdgeId(),
			source: subId,
			target: endId,
			data: {}
		}]);
		setEntry(nextEntry);
		setSelectedId(subId);
		setDirty(true);
	}, [
		record,
		placePoint,
		setNodes,
		setEdges
	]);
	const copyNode = react.useCallback((id) => {
		if (id === null) return;
		const snapshot = liveRef.current;
		const body = snapshot.bodies[id];
		if (body === void 0) return;
		const node = snapshot.nodes.find((item) => item.id === id);
		const copy = { ...body };
		delete copy.next;
		delete copy.branches;
		const title = node?.data.title ?? body.title ?? id;
		setClipboard({
			body: copy,
			title
		});
		reportInfo(`已复制节点「${title}」`);
	}, []);
	const pasteNode = react.useCallback((at) => {
		const item = clipboardRef.current;
		if (item === null) return;
		record();
		const id = nextNodeId(liveRef.current.nodes, issuedRef.current);
		issuedRef.current.add(id);
		const body = {
			...item.body,
			id
		};
		insertNode(body, item.title, at);
	}, [record, insertNode]);
	/** 从卡点出口拖出来的线：带上 outlet，保存时才知道这条分支属于哪个选项 */
	const outletOfConnection = (source, sourceHandle, snapshot) => {
		if (sourceHandle === null) return void 0;
		return (snapshot.nodes.find((item) => item.id === source)?.data.outlets ?? []).find((outlet) => `out-${outlet.key}` === sourceHandle);
	};
	const onConnect = react.useCallback((connection) => {
		if (connection.source === null || connection.target === null) return;
		const snapshot = liveRef.current;
		if (!snapshot.nodes.some((node) => node.id === connection.target)) return;
		if (connection.target === snapshot.entry) {
			reportInfo("入口节点不能有入线：先把别的节点设为入口");
			return;
		}
		const outlet = outletOfConnection(connection.source, connection.sourceHandle, snapshot);
		if (snapshot.edges.some((edge) => edge.source === connection.source && edge.target === connection.target && (edge.data?.outlet ?? "") === (outlet?.key ?? ""))) {
			reportInfo("这两个节点之间已经有这条连线了");
			return;
		}
		if (outlet !== void 0 && snapshot.edges.some((edge) => edge.source === connection.source && edge.data?.outlet === outlet.key)) {
			reportInfo(`出口「${outlet.label}」已经连了别的节点：先删掉那条线，或从别的出口连`);
			return;
		}
		record();
		setEdges((current) => addEdge({
			id: newEdgeId(),
			source: connection.source,
			target: connection.target,
			sourceHandle: connection.sourceHandle,
			targetHandle: connection.targetHandle,
			...outlet !== void 0 ? {
				label: outlet.label,
				data: { outlet: outlet.key }
			} : { data: {} }
		}, current));
		setDirty(true);
	}, [record, setEdges]);
	/** 拖动已有连线的端点改指向：保留边上的条件/出口绑定，只换 source/target */
	const onReconnect = react.useCallback((oldEdge, connection) => {
		const source = connection.source;
		const target = connection.target;
		if (source === null || target === null) return;
		const snapshot = liveRef.current;
		if (target === snapshot.entry) {
			reportInfo("入口节点不能有入线：先把别的节点设为入口");
			return;
		}
		if (snapshot.edges.some((edge) => edge.id !== oldEdge.id && edge.source === source && edge.target === target)) {
			reportInfo("这两个节点之间已经有这条连线了");
			return;
		}
		const reconnectOutlet = outletOfConnection(source, connection.sourceHandle, snapshot);
		if (reconnectOutlet !== void 0 && snapshot.edges.some((edge) => edge.id !== oldEdge.id && edge.source === source && edge.data?.outlet === reconnectOutlet.key)) {
			reportInfo(`出口「${reconnectOutlet.label}」已经连了别的节点：先删掉那条线，或从别的出口连`);
			return;
		}
		record();
		setEdges((all) => all.map((edge) => {
			if (edge.id !== oldEdge.id) return edge;
			const outlet = outletOfConnection(source, connection.sourceHandle, snapshot);
			const data = { ...edge.data ?? {} };
			data.outlet = outlet !== void 0 ? outlet.key : "";
			return {
				...edge,
				source,
				target,
				sourceHandle: connection.sourceHandle,
				targetHandle: connection.targetHandle,
				...outlet !== void 0 ? { label: outlet.label } : {},
				data
			};
		}));
		setDirty(true);
	}, [record, setEdges]);
	const handleEdgesChange = react.useCallback((changes) => {
		const removing = changes.some((change) => change.type === "remove");
		const mutating = changes.some((change) => change.type === "add" || change.type === "remove" || change.type === "replace");
		if (removing) record();
		onEdgesChange(changes);
		if (mutating) setDirty(true);
	}, [onEdgesChange, record]);
	const patchNode = (patch) => {
		if (selectedId === null) return;
		const current = bodies[selectedId];
		if (current === void 0) return;
		record(`patch:${selectedId}:${Object.keys(patch).join(",")}`);
		const next = {
			...current,
			...patch
		};
		setBodies((all) => ({
			...all,
			[selectedId]: next
		}));
		if (current.type === "gate" && Array.isArray(patch.options)) {
			const labels = new Map(patch.options.map((entry) => [entry.id, entry.label]));
			setEdges((all) => {
				let changed = false;
				const kept = [];
				for (const edge of all) {
					const outlet = edge.source === selectedId ? edge.data?.outlet : void 0;
					if (outlet === void 0) {
						kept.push(edge);
						continue;
					}
					const label = labels.get(outlet);
					if (label === void 0) {
						changed = true;
						continue;
					}
					if (edge.label === label) {
						kept.push(edge);
						continue;
					}
					changed = true;
					kept.push({
						...edge,
						label
					});
				}
				return changed ? kept : all;
			});
		}
		setNodes((all) => all.map((node) => node.id === selectedId ? {
			...node,
			data: {
				...node.data,
				title: typeof patch.title === "string" ? patch.title : node.data.title,
				detail: detailOf(next),
				outlets: outletsOf(next),
				subflow: next.type === "subagent" && next.mode === "subflow" && next.subflow !== void 0 ? subflowPreview(next.subflow) : void 0
			}
		} : node));
		setDirty(true);
	};
	const deleteNode = () => {
		if (selectedId === null) return;
		deleteNodeById(selectedId);
	};
	const setCondition = (edgeId, value) => {
		record(`condition:${edgeId}`);
		setEdges((all) => all.map((edge) => edge.id === edgeId ? {
			...edge,
			label: value === "" ? "条件" : value === "*" ? "默认" : value,
			data: {
				...edge.data ?? {},
				condition: value
			}
		} : edge));
		setDirty(true);
	};
	const setWhen = (edgeId, value) => {
		record(`when:${edgeId}`);
		const when = value.trim() === "" ? "" : value;
		setEdges((all) => all.map((edge) => edge.id === edgeId ? {
			...edge,
			data: {
				...edge.data ?? {},
				when
			}
		} : edge));
		setDirty(true);
	};
	/** 角色表改动：整体替换，撤销栈里也存一份。角色表全图共享，各层读的都是这份 state。 */
	const changeAgents = (next) => {
		record("agents");
		setAgents(next);
		setDirty(true);
	};
	/** 点了卡片右侧的出口名字：记下来，下一次点目标节点就把它连上（鼠标也可以直接从圆点拖） */
	const startOutletLink = (nodeId, outletKey) => {
		setPendingLink((current) => current !== null && current.nodeId === nodeId && current.outletKey === outletKey ? null : {
			nodeId,
			outletKey
		});
	};
	const completeOutletLink = (targetId) => {
		const pending = pendingLink;
		if (pending === null) return;
		setPendingLink(null);
		const { nodeId, outletKey } = pending;
		if (targetId === nodeId) return;
		const outlet = (nodes.find((node) => node.id === nodeId)?.data.outlets ?? []).find((item) => item.key === outletKey);
		if (outlet === void 0) return;
		if (targetId === entry) {
			reportInfo("入口节点不能有入线：先把别的节点设为入口");
			return;
		}
		if (edges.some((edge) => edge.source === nodeId && edge.data?.outlet === outletKey)) {
			reportInfo(`出口「${outlet.label}」已经连了别的节点：先删掉那条线，或从别的出口连`);
			return;
		}
		if (edges.some((edge) => edge.source === nodeId && edge.target === targetId)) {
			reportInfo("这两个节点之间已经有这条连线了");
			return;
		}
		record(`connect:${nodeId}:${outletKey}`);
		setEdges((all) => addEdge({
			id: newEdgeId(),
			source: nodeId,
			target: targetId,
			sourceHandle: `out-${outletKey}`,
			label: outlet.label,
			data: { outlet: outletKey }
		}, all));
		setDirty(true);
	};
	const rename = (value) => {
		record("flow-name");
		setName(value);
	};
	react.useEffect(() => {
		const onKeyDown = (event) => {
			const page = pageRef.current;
			const active = document.activeElement;
			if (page !== null && active !== null && active !== document.body && !page.contains(active)) return;
			const mod = event.ctrlKey || event.metaKey;
			const key = event.key.toLowerCase();
			if (mod && key === "s") {
				event.preventDefault();
				saveRef.current?.();
				return;
			}
			const target = event.target;
			if (target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
			if (event.key === "Escape") {
				if (pendingLink !== null) {
					setPendingLink(null);
					return;
				}
				if (valOpen) {
					setValOpen(false);
					return;
				}
				if (menu !== null) {
					setMenu(null);
					return;
				}
				setSelectedId(null);
				return;
			}
			if (!mod && (event.key === "Delete" || event.key === "Backspace")) {
				event.preventDefault();
				deleteSelected();
				return;
			}
			if (!mod) return;
			if (key === "z") {
				event.preventDefault();
				if (event.shiftKey) redo();
				else undo();
				return;
			}
			if (key === "y") {
				event.preventDefault();
				redo();
				return;
			}
			if (key === "c") {
				if ((window.getSelection()?.toString() ?? "") !== "") return;
				event.preventDefault();
				copyNode(selectedRef.current);
				return;
			}
			if (key === "v") {
				event.preventDefault();
				pasteNode();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [
		deleteSelected,
		redo,
		undo,
		copyNode,
		pasteNode,
		pendingLink,
		valOpen,
		menu
	]);
	const handleApi = react.useCallback((next) => {
		canvasApiRef.current = next;
	}, []);
	react.useEffect(() => {
		let alive = true;
		payloadFields(initial.id).then((fields) => {
			if (alive) setPayloadFields(fields);
		}).catch(() => {});
		return () => {
			alive = false;
		};
	}, [initial.id]);
	react.useEffect(() => {
		let alive = true;
		const timer = window.setTimeout(() => {
			let flow;
			try {
				flow = composeRoot();
			} catch {
				return;
			}
			validateFlow(flow).then((result) => {
				if (alive) setValidation(result);
			}).catch(() => {});
		}, 350);
		return () => {
			alive = false;
			window.clearTimeout(timer);
		};
	}, [
		nodes,
		edges,
		bodies,
		agents,
		entry,
		name,
		frames.length
	]);
	const save = async () => {
		setBusy(true);
		setBanner(null);
		try {
			const result = await saveFlow(composeRoot());
			if (result.ok) {
				const nextFrames = [];
				framesRef.current = nextFrames;
				setFrames(nextFrames);
				loadGraph(result.flow);
				savedSignatureRef.current = null;
				setDirty(false);
				setBanner({
					kind: "ok",
					lines: result.warnings.length > 0 ? ["已保存（有警告）", ...result.warnings.map((item) => item.message)] : ["已保存"]
				});
			} else setBanner({
				kind: "error",
				lines: result.errors.length > 0 ? result.errors.map((item) => item.message) : ["校验未通过"]
			});
		} catch (cause) {
			setBanner({
				kind: "error",
				lines: [errorText$2(cause)]
			});
		} finally {
			setBusy(false);
		}
	};
	const selected = selectedId === null ? void 0 : bodies[selectedId];
	const selectedCanvas = nodes.find((node) => node.id === selectedId);
	const selectedEdges = edges.filter((edge) => edge.source === selectedId);
	const validationChip = validation === null ? null : !validation.ok ? {
		kind: "error",
		text: `✕ ${validation.errors.length} 处硬拒`
	} : validation.warnings.length > 0 ? {
		kind: "warn",
		text: `⚠ ${validation.warnings.length} 条警告`
	} : {
		kind: "ok",
		text: "✓ 校验通过"
	};
	const jumpToNode = (nodeId) => {
		if (nodeId === void 0) return;
		setSelectedId(nodeId);
		canvasApiRef.current?.focusNode?.(nodeId);
		setValOpen(false);
	};
	saveRef.current = () => {
		save();
	};
	const confirmLeave = () => !dirty || window.confirm("有未保存的改动，离开会丢失。确定离开？");
	react.useEffect(() => {
		if (!dirty) return void 0;
		const onBeforeUnload = (event) => {
			event.preventDefault();
			event.returnValue = "";
		};
		window.addEventListener("beforeunload", onBeforeUnload);
		return () => window.removeEventListener("beforeunload", onBeforeUnload);
	}, [dirty]);
	react.useEffect(() => {
		try {
			window.localStorage.setItem(INSPECTOR_WIDTH_KEY, String(inspectorWidth));
		} catch {}
	}, [inspectorWidth]);
	/** 面板最宽：画布至少留 CANVAS_MIN（再扣掉分隔条本身的宽度） */
	const maxInspectorWidth = () => {
		const total = bodyRef.current?.clientWidth ?? 0;
		return total > 0 ? Math.min(INSPECTOR_MAX, total - CANVAS_MIN - 8) : INSPECTOR_MAX;
	};
	const startResize = (event) => {
		if (event.button !== 0) return;
		event.preventDefault();
		event.currentTarget.setPointerCapture(event.pointerId);
		resizeRef.current = {
			startX: event.clientX,
			startWidth: inspectorWidth,
			pointerId: event.pointerId
		};
		setResizing(true);
		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";
	};
	const moveResize = (event) => {
		const drag = resizeRef.current;
		if (drag === null) return;
		setInspectorWidth(clampInspectorWidth(drag.startWidth + (drag.startX - event.clientX), maxInspectorWidth()));
	};
	const endResize = (event) => {
		const drag = resizeRef.current;
		if (drag === null) return;
		resizeRef.current = null;
		setResizing(false);
		document.body.style.cursor = "";
		document.body.style.userSelect = "";
		try {
			event.currentTarget.releasePointerCapture(drag.pointerId);
		} catch {}
	};
	react.useEffect(() => () => {
		document.body.style.cursor = "";
		document.body.style.userSelect = "";
	}, []);
	const onSplitterKeyDown = (event) => {
		const step = event.shiftKey ? 48 : 16;
		if (event.key === "ArrowLeft") {
			event.preventDefault();
			setInspectorWidth((width) => clampInspectorWidth(width + step, maxInspectorWidth()));
		} else if (event.key === "ArrowRight") {
			event.preventDefault();
			setInspectorWidth((width) => clampInspectorWidth(width - step, maxInspectorWidth()));
		} else if (event.key === "Home") {
			event.preventDefault();
			setInspectorWidth(INSPECTOR_DEFAULT);
		}
	};
	const menuItems = react.useMemo(() => {
		if (menu === null) return [];
		if (menu.kind === "pane") {
			const at = menu.at;
			return [{
				id: "create",
				label: "新建节点",
				children: PALETTE.map((item) => ({
					id: `add-${item.type}`,
					label: item.label,
					onSelect: () => addNode(item.type, at)
				}))
			}, {
				id: "paste",
				label: "粘贴节点",
				hint: clipboard === null ? "剪贴板为空" : "Ctrl+V",
				disabled: clipboard === null,
				onSelect: () => pasteNode(at)
			}];
		}
		if (menu.kind === "node") {
			const id = menu.id;
			return [
				{
					id: "copy",
					label: "复制节点",
					hint: "Ctrl+C",
					onSelect: () => copyNode(id)
				},
				{
					id: "paste",
					label: "粘贴节点",
					hint: clipboard === null ? "剪贴板为空" : "Ctrl+V",
					disabled: clipboard === null,
					onSelect: () => pasteNode()
				},
				{
					id: "entry",
					label: "设为入口",
					disabled: entry === id,
					onSelect: () => setEntryId(id)
				},
				{
					id: "delete",
					label: "删除节点",
					hint: "Delete",
					danger: true,
					onSelect: () => deleteNodeById(id)
				}
			];
		}
		const edgeId = menu.id;
		return [{
			id: "delete-edge",
			label: "删除连线",
			hint: "Delete",
			danger: true,
			onSelect: () => deleteEdgeById(edgeId)
		}];
	}, [
		menu,
		clipboard,
		entry,
		addNode,
		pasteNode,
		copyNode,
		setEntryId,
		deleteNodeById,
		deleteEdgeById
	]);
	return /* @__PURE__ */ react.createElement("div", {
		className: "wf-page",
		style: PAGE_STYLE$1,
		ref: pageRef
	}, /* @__PURE__ */ react.createElement("style", null, editorCss), /* @__PURE__ */ react.createElement("header", { className: "wf-head" }, /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "wf-btn",
		onClick: () => {
			if (frames.length > 0) {
				backToParent();
				return;
			}
			if (confirmLeave()) onBack();
		},
		title: frames.length > 0 ? "返回上一层子图（当前子图会写回父节点）" : "返回流程库（有未保存改动会先确认）"
	}, frames.length > 0 ? frames.length > 1 ? "← 返回上层" : "← 返回主图" : "← 流程库"), /* @__PURE__ */ react.createElement("input", {
		className: "wf-input",
		style: { width: 200 },
		value: name,
		onChange: (event) => rename(event.target.value)
	}), initial.kind === "agent" && /* @__PURE__ */ react.createElement("span", { className: "wf-chip" }, "子 Agent 配置"), frames.length > 0 && /* @__PURE__ */ react.createElement("span", {
		className: "wf-crumb",
		title: [
			"主图",
			...frames.map((frame) => frame.title),
			name
		].join(" / ")
	}, "主图", frames.map((frame) => /* @__PURE__ */ react.createElement(react.Fragment, { key: frame.parentNodeId }, /* @__PURE__ */ react.createElement("span", null, "/"), /* @__PURE__ */ react.createElement("b", null, frame.title))), /* @__PURE__ */ react.createElement("span", null, "/"), /* @__PURE__ */ react.createElement("b", null, name)), /* @__PURE__ */ react.createElement("span", { className: "wf-sub" }, dirty ? "未保存" : "已同步"), validationChip !== null && /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "wf-btn",
		"data-tone": validationChip.kind,
		onClick: () => setValOpen((open) => !open),
		title: "校验结果（与保存同一个校验器；点条目可定位节点）"
	}, validationChip.text), /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "wf-btn",
		onClick: undo,
		disabled: history.past.length === 0,
		title: "撤销（Ctrl+Z）"
	}, "撤销"), /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "wf-btn",
		onClick: redo,
		disabled: history.future.length === 0,
		title: "重做（Ctrl+Shift+Z / Ctrl+Y）"
	}, "重做"), /* @__PURE__ */ react.createElement("span", { className: "wf-spacer" }), /* @__PURE__ */ react.createElement("span", { className: "wf-sub" }, "入口：", bodies[entry]?.title ?? entry), /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "wf-btn",
		"data-primary": "true",
		onClick: () => void save(),
		disabled: busy
	}, busy ? "保存中…" : "保存"), onExit !== void 0 && /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "wf-btn",
		onClick: () => {
			if (confirmLeave()) onExit();
		}
	}, "返回会话")), valOpen && validation !== null && /* @__PURE__ */ react.createElement("div", {
		className: "wf-val-pop",
		role: "dialog",
		"aria-label": "校验结果"
	}, /* @__PURE__ */ react.createElement("div", { className: "wf-val-head" }, "校验结果（与保存同一个 validateFlow）"), validation.errors.length === 0 && validation.warnings.length === 0 && /* @__PURE__ */ react.createElement("div", { className: "wf-hint" }, "没有发现问题，可以保存。"), [...validation.errors, ...validation.warnings].map((issue, index) => /* @__PURE__ */ react.createElement("button", {
		type: "button",
		key: `${issue.code}-${index}`,
		className: "wf-val-item",
		"data-kind": issue.severity,
		disabled: issue.nodeId === void 0,
		title: issue.nodeId === void 0 ? "这条问题没有关联节点" : `定位到 ${issue.nodeId}`,
		onClick: () => jumpToNode(issue.nodeId)
	}, /* @__PURE__ */ react.createElement("span", { className: "wf-val-code" }, issue.code), /* @__PURE__ */ react.createElement("span", { className: "wf-val-msg" }, issue.message)))), /* @__PURE__ */ react.createElement("div", { className: "wf-palette" }, /* @__PURE__ */ react.createElement("span", { className: "wf-sub" }, "添加节点："), PALETTE.map((item) => /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "wf-btn",
		key: item.type,
		onClick: () => addNode(item.type)
	}, "+ ", item.label)), /* @__PURE__ */ react.createElement("span", { className: "wf-sub" }, "模板："), TEMPLATES.map((template) => /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "wf-btn",
		key: template.kind,
		title: template.hint,
		onClick: () => insertTemplate(template.kind)
	}, "+ ", template.label)), /* @__PURE__ */ react.createElement("span", { className: "wf-spacer" }), /* @__PURE__ */ react.createElement("span", { className: "wf-sub" }, "右键画布可在指针处新建 / 粘贴；选中后 Ctrl+C 复制")), banner !== null && /* @__PURE__ */ react.createElement("div", {
		className: "wf-banner",
		"data-kind": banner.kind
	}, banner.lines[0], banner.lines.length > 1 && /* @__PURE__ */ react.createElement("ul", null, banner.lines.slice(1).map((line, index) => /* @__PURE__ */ react.createElement("li", { key: index }, line)))), /* @__PURE__ */ react.createElement("div", {
		className: "wf-body",
		ref: bodyRef
	}, /* @__PURE__ */ react.createElement(Boundary, { label: "画布" }, /* @__PURE__ */ react.createElement(FlowCanvas, {
		nodes,
		edges,
		onNodesChange,
		onEdgesChange: handleEdgesChange,
		onConnect,
		onReconnect,
		onSelect: (id) => {
			if (id === null) {
				setPendingLink(null);
				setSelectedId(null);
				return;
			}
			if (pendingLink !== null) {
				completeOutletLink(id);
				return;
			}
			setSelectedId(id);
		},
		onOutletClick: startOutletLink,
		onOpenSubflow: openSubflow,
		onMoveNode: () => setDirty(true),
		onDragNode: () => record(),
		onPaneMenu: (screen, flowPoint) => setMenu({
			kind: "pane",
			x: screen.x,
			y: screen.y,
			at: flowPoint
		}),
		onNodeMenu: (screen, id) => {
			setNodes((all) => all.map((node) => node.selected === (node.id === id) ? node : {
				...node,
				selected: node.id === id
			}));
			setMenu({
				kind: "node",
				x: screen.x,
				y: screen.y,
				id
			});
		},
		onEdgeMenu: (screen, id) => setMenu({
			kind: "edge",
			x: screen.x,
			y: screen.y,
			id
		}),
		onApi: handleApi
	})), pendingLink !== null && /* @__PURE__ */ react.createElement("div", { className: "wf-connect-hint" }, /* @__PURE__ */ react.createElement("span", null, "已选出口「", nodes.find((node) => node.id === pendingLink.nodeId)?.data.outlets?.find((outlet) => outlet.key === pendingLink.outletKey)?.label ?? pendingLink.outletKey, "」：点一个目标节点完成连接，或按 Esc 取消"), /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "wf-btn",
		onClick: () => setPendingLink(null)
	}, "取消")), /* @__PURE__ */ react.createElement("div", {
		className: "wf-splitter",
		"data-dragging": resizing ? "true" : "false",
		role: "separator",
		"aria-orientation": "vertical",
		"aria-label": "调整属性面板宽度",
		"aria-valuemin": INSPECTOR_MIN,
		"aria-valuemax": INSPECTOR_MAX,
		"aria-valuenow": inspectorWidth,
		tabIndex: 0,
		title: "拖动调整属性面板宽度；双击复位",
		onPointerDown: startResize,
		onPointerMove: moveResize,
		onPointerUp: endResize,
		onPointerCancel: endResize,
		onDoubleClick: () => setInspectorWidth(INSPECTOR_DEFAULT),
		onKeyDown: onSplitterKeyDown
	}), /* @__PURE__ */ react.createElement("aside", {
		className: "wf-inspector",
		style: { width: inspectorWidth }
	}, /* @__PURE__ */ react.createElement(Inspector, {
		body: selected,
		canvasNode: selectedCanvas,
		nodes,
		flows: flows.filter((item) => item.id !== initial.id),
		agents,
		payloadFields: payloadFields$1,
		edges: selectedEdges,
		isEntry: selectedId !== null && entry === selectedId,
		issues: validation === null || selectedId === null ? [] : [...validation.errors, ...validation.warnings].filter((issue) => issue.nodeId === selectedId),
		onPatch: patchNode,
		onDelete: deleteNode,
		onCondition: setCondition,
		onWhen: setWhen,
		onAgentsChange: changeAgents,
		onOpenSubflow: openSubflow,
		onSetEntry: () => {
			if (selectedId !== null) setEntryId(selectedId);
		}
	}))), menu !== null && /* @__PURE__ */ react.createElement(ContextMenu, {
		x: menu.x,
		y: menu.y,
		heading: menu.kind === "pane" ? "画布" : menu.kind === "node" ? "节点操作" : "连线操作",
		items: menuItems,
		onClose: () => setMenu(null)
	}));
}
var edgeSeq = 0;
function newEdgeId() {
	edgeSeq += 1;
	return `e-${Date.now().toString(36)}-${edgeSeq}`;
}
/** 按入口 id 给画布节点刷「入口」标记；状态没变的对象原样返回，别制造无谓重建 */
function withEntryFlags(nodes, entry) {
	return nodes.map((node) => {
		const isEntry = node.id === entry;
		if (node.data.isEntry === isEntry) return node;
		return {
			...node,
			data: {
				...node.data,
				isEntry
			}
		};
	});
}
/** 复用被删掉的最小 nN，保证 id 可读且不撞（nodes + 本次会话已发过的 id 都算占用） */
function nextNodeId(nodes, issued) {
	const used = new Set(issued);
	for (const node of nodes) used.add(node.id);
	for (let index = 1; index < 1e5; index += 1) {
		const id = `n${index}`;
		if (!used.has(id)) return id;
	}
	return `n${Date.now().toString(36)}`;
}
function errorText$2(error) {
	return error instanceof Error ? error.message : String(error);
}
//#endregion
//#region
var NS = "aiworkflow-progress";
var ZH = {
	"btn.open": "打开 aiworkflow 执行进度",
	title: "执行进度",
	idle: "工作流",
	"phase.running": "进行中",
	"phase.gate": "等确认",
	"phase.children": "等子 Agent",
	"phase.finished": "已完成",
	"phase.failed": "失败",
	"phase.stale": "停滞",
	steps: "步",
	"hero.current": "当前步骤",
	"hero.last": "最后一步",
	"hero.steps": "已走步数",
	"hero.elapsed": "用时",
	"hero.started": "开始",
	path: "已走路径",
	trace: "执行轨迹",
	"trace.empty": "还没有执行记录",
	"gate.title": "等待人工确认",
	"gate.hint": "在对话里回复选项后，这里会自动继续。",
	loading: "读取中…",
	"empty.noDb": "还没有 aiworkflow 数据",
	"empty.noDbHint": "先在「可视化工作流」里新建并保存一张图，这里会自动出现正在执行的流程。",
	"empty.noRuns": "还没有 run",
	"empty.noRunsHint": "等主 Agent 领取第一步后，进度就会出现在这里。",
	"empty.dbPath": "数据库",
	"empty.error": "读取失败",
	"run.active": "进行中",
	"run.recent": "最近",
	"run.select": "切换 run",
	"foot.updated": "更新于",
	nodes: "个节点",
	"payload.hint": "点击查看 payload",
	"panel.label": "可视化工作流",
	"panel.runs": "运行图",
	"panel.abandon": "放弃"
};
var EN = {
	"btn.open": "Open aiworkflow progress",
	title: "Run progress",
	idle: "Workflow",
	"phase.running": "Running",
	"phase.gate": "Needs input",
	"phase.children": "Waiting",
	"phase.finished": "Done",
	"phase.failed": "Failed",
	"phase.stale": "Stalled",
	steps: " steps",
	"hero.current": "Current step",
	"hero.last": "Last step",
	"hero.steps": "Steps",
	"hero.elapsed": "Elapsed",
	"hero.started": "Started",
	path: "Path so far",
	trace: "Trace",
	"trace.empty": "No executions yet",
	"gate.title": "Waiting for a decision",
	"gate.hint": "Reply with an option in the conversation; this view follows automatically.",
	loading: "Loading…",
	"empty.noDb": "No aiworkflow data yet",
	"empty.noDbHint": "Create and save a flow in Visual Workflows and this view starts following the run.",
	"empty.noRuns": "No runs yet",
	"empty.noRunsHint": "Progress appears here once the main agent claims its first step.",
	"empty.dbPath": "Database",
	"empty.error": "Read failed",
	"run.active": "Running",
	"run.recent": "Recent",
	"run.select": "Switch run",
	"foot.updated": "Updated",
	nodes: " nodes",
	"payload.hint": "Click to inspect the payload",
	"panel.label": "Visual workflows",
	"panel.runs": "Run graph",
	"panel.abandon": "Abandon"
};
function phaseKey(phase) {
	return `phase.${phase}`;
}
function registerTexts(ctx) {
	const disposers = [];
	const packs = [
		["en", EN],
		["zh", ZH],
		["zh-CN", ZH],
		["zh-Hans", ZH]
	];
	for (const [locale, dict] of packs) try {
		const dispose = ctx.locale.register(NS, locale, dict);
		if (typeof dispose === "function") disposers.push(dispose);
	} catch {}
	return () => {
		for (const dispose of disposers) try {
			dispose();
		} catch {}
	};
}
function bindTranslate(ctx) {
	const raw = ctx.locale.bind(NS);
	return (key) => {
		const value = raw(key);
		return value === key ? ZH[key] ?? key : value;
	};
}
//#endregion
//#region
var runCss = `
.awr-page{display:flex;flex-direction:column;height:100%;min-height:420px;min-width:0;
  color:var(--dsw-alias-label-primary);font-size:13px;background:var(--dsw-alias-bg-base)}
.awr-head{display:flex;align-items:center;gap:8px;padding:10px 14px;flex:none;flex-wrap:wrap;
  border-bottom:1px solid var(--dsw-alias-border-l1)}
.awr-title{font-weight:600;font-size:13px}
.awr-sub{font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.awr-spacer{flex:1}
.awr-btn{height:26px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);
  background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}
.awr-btn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.awr-btn[data-sel="true"]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary);
  background:var(--dsw-alias-bg-layer-2)}
.awr-runs{display:flex;align-items:center;gap:6px;padding:8px 14px;flex:none;overflow-x:auto;
  border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.awr-run{display:flex;align-items:center;gap:6px;height:24px;padding:0 8px;border-radius:999px;flex:none;
  border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);
  font:inherit;font-size:11.5px;cursor:pointer;max-width:220px}
.awr-run:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.awr-run[data-sel="true"]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary);
  background:var(--dsw-alias-bg-layer-2)}
.awr-run-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.awr-dot{width:7px;height:7px;border-radius:50%;flex:none;background:var(--dsw-alias-state-idle-primary,var(--dsw-alias-border-l2))}
.awr-dot[data-phase="running"]{background:var(--dsw-alias-brand-primary)}
.awr-dot[data-phase="gate"]{background:var(--dsw-alias-state-warn-primary)}
.awr-dot[data-phase="children"]{background:var(--dsw-alias-state-warn-primary)}
.awr-dot[data-phase="finished"]{background:var(--dsw-alias-state-success-primary)}
.awr-dot[data-phase="failed"]{background:var(--dsw-alias-state-error-primary)}
.awr-body{flex:1;display:flex;min-height:0}
.awr-canvas{flex:1;min-width:0;min-height:0;position:relative;background:var(--dsw-alias-bg-base);
  --xy-background-color:var(--dsw-alias-bg-base);
  --xy-background-pattern-color:var(--dsw-alias-border-l2);
  --xy-edge-stroke:var(--dsw-alias-border-l2);
  --xy-edge-stroke-selected:var(--dsw-alias-brand-primary);
  --xy-edge-label-background-color:var(--dsw-alias-bg-layer-2);
  --xy-edge-label-color:var(--dsw-alias-label-secondary);
  --xy-handle-background-color:var(--dsw-alias-border-l2);
  --xy-handle-border-color:var(--dsw-alias-bg-base);
  --xy-controls-button-background-color:var(--dsw-alias-bg-layer-2);
  --xy-controls-button-background-color-hover:var(--dsw-alias-bg-layer-1);
  --xy-controls-button-color:var(--dsw-alias-label-primary);
  --xy-controls-button-border-color:var(--dsw-alias-border-l1);
  --xy-controls-box-shadow:0 0 0 1px var(--dsw-alias-border-l1);
  --xy-attribution-background-color:transparent}
.awr-rail{width:320px;flex:none;border-left:1px solid var(--dsw-alias-border-l1);overflow-y:auto;
  padding:10px 12px;background:var(--dsw-alias-bg-layer-1);display:flex;flex-direction:column;gap:10px}
.awr-meta{font-size:11px;color:var(--dsw-alias-label-secondary);line-height:1.6;word-break:break-word}
.awr-meta code{font-size:10.5px}
.awr-node{min-width:140px;max-width:196px;padding:8px 10px;border-radius:10px;
  border:1px solid var(--dsw-alias-border-l2);border-left-width:3px;
  background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);box-shadow:0 2px 8px rgba(15,23,42,.12)}
.awr-node[data-state="idle"]{opacity:.72;border-left-color:var(--dsw-alias-border-l2)}
.awr-node[data-state="done"]{border-left-color:var(--dsw-alias-state-success-primary)}
.awr-node[data-state="current"]{border-left-color:var(--dsw-alias-brand-primary);
  box-shadow:0 0 0 1px var(--dsw-alias-brand-primary),0 2px 10px rgba(15,23,42,.16)}
.awr-node[data-state="waiting"]{border-left-color:var(--dsw-alias-state-warn-primary)}
.awr-node[data-state="blocked"]{border-left-color:var(--dsw-alias-state-error-primary)}
.awr-node[data-selected="true"]{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.awr-node-top{display:flex;align-items:center;gap:6px;font-size:9.5px;letter-spacing:.04em;font-weight:700;
  color:var(--dsw-alias-label-secondary);text-transform:uppercase}
.awr-node-kind{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.awr-node-count{color:var(--dsw-alias-brand-primary);text-transform:none;font-size:10px}
.awr-node-state{margin-left:auto;text-transform:none;font-weight:600;letter-spacing:0}
.awr-node[data-state="done"] .awr-node-state{color:var(--dsw-alias-state-success-primary)}
.awr-node[data-state="current"] .awr-node-state{color:var(--dsw-alias-brand-primary)}
.awr-node[data-state="waiting"] .awr-node-state{color:var(--dsw-alias-state-warn-primary)}
.awr-node[data-state="blocked"] .awr-node-state{color:var(--dsw-alias-state-error-primary)}
.awr-node-title{font-size:12.5px;font-weight:600;margin-top:2px;word-break:break-word}
.awr-node-detail{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:2px;word-break:break-word}
.awr-empty{margin:auto;padding:32px 18px;text-align:center;color:var(--dsw-alias-label-secondary);
  display:flex;flex-direction:column;gap:8px;align-items:center}
.awr-empty code{font-size:11px}
.awr-card{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:8px 10px;
  background:var(--dsw-alias-bg-layer-2);display:flex;flex-direction:column;gap:6px}
.awr-card-title{font-size:11.5px;font-weight:600;display:flex;align-items:center;gap:6px}
.awr-child{display:flex;align-items:center;gap:6px;width:100%;padding:4px 6px;border-radius:7px;
  border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;
  font-size:11px;text-align:left;cursor:pointer;overflow:hidden}
.awr-child:hover{background:var(--dsw-alias-bg-layer-1);border-color:var(--dsw-alias-border-l1);
  color:var(--dsw-alias-label-primary)}
.awr-child[data-sel="true"]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary)}
.awr-child-node{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10px;
  opacity:.75;flex:none;max-width:88px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.awr-card-q{font-size:12px;line-height:1.5}
.awr-card-opts{display:flex;flex-wrap:wrap;gap:6px}
.awr-opt{font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);
  color:var(--dsw-alias-label-secondary)}
.awr-card-hint{font-size:10.5px;color:var(--dsw-alias-label-secondary);line-height:1.5}
.awr-trace{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
.awr-trace-item{display:flex;gap:8px;padding:6px 8px;border-radius:8px;cursor:pointer;
  border:1px solid transparent;font-size:12px}
.awr-trace-item:hover{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l1)}
.awr-trace-item[data-sel="true"]{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-brand-primary)}
.awr-trace-seq{width:16px;flex:none;color:var(--dsw-alias-label-secondary);font-size:10.5px;text-align:right;padding-top:1px}
.awr-trace-body{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1}
.awr-trace-node{display:flex;align-items:center;gap:6px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.awr-trace-iter{font-style:normal;font-size:10px;font-weight:600;color:var(--dsw-alias-label-secondary)}
.awr-chip{font-size:9.5px;padding:0 6px;border-radius:999px;border:1px solid currentColor;line-height:15px;flex:none}
.awr-chip[data-tone="ok"]{color:var(--dsw-alias-state-success-primary)}
.awr-chip[data-tone="warn"]{color:var(--dsw-alias-state-warn-primary)}
.awr-chip[data-tone="bad"]{color:var(--dsw-alias-state-error-primary)}
.awr-trace-summary{font-size:11px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap}
.awr-trace-sub{font-size:10px;color:var(--dsw-alias-label-secondary);opacity:.85}
.awr-payload{margin:0;padding:8px;border-radius:8px;background:var(--dsw-alias-bg-base);
  border:1px solid var(--dsw-alias-border-l1);font-size:10.5px;line-height:1.5;overflow:auto;max-height:220px;
  white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-secondary)}
.react-flow__attribution{background:transparent;color:var(--dsw-alias-label-secondary);font-size:9px;opacity:.6}
.awr-backdrop{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;
  padding:24px;background:color-mix(in srgb,var(--dsw-alias-bg-base) 55%,transparent)}
.awr-dialog{position:relative;display:flex;flex-direction:column;width:min(1080px,100%);height:min(740px,100%);
  border:1px solid var(--dsw-alias-border-l2);border-radius:14px;overflow:hidden;background:var(--dsw-alias-bg-base);
  box-shadow:0 24px 64px rgba(15,23,42,.32)}
.awr-dialog .awr-page{height:100%}
.awr-dialog-close{position:absolute;top:8px;right:8px;width:26px;height:26px;border-radius:8px;
  border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);
  color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:1;cursor:pointer}
.awr-dialog-close:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1)}
`;
//#endregion
//#region
function RunNode({ id, data, selected }) {
	const shown = data.detail.length > 64 ? `${data.detail.slice(0, 64)}…` : data.detail;
	const outCount = useStore((state) => state.edges.reduce((total, edge) => edge.source === id ? total + 1 : total, 0));
	const slots = Math.max(outCount, 1);
	return /* @__PURE__ */ react.createElement("div", {
		className: "awr-node",
		"data-state": data.state,
		"data-selected": selected ? "true" : "false"
	}, /* @__PURE__ */ react.createElement(Handle, {
		type: "target",
		position: Position.Left,
		isConnectable: false
	}), /* @__PURE__ */ react.createElement("div", { className: "awr-node-top" }, /* @__PURE__ */ react.createElement("span", { className: "awr-node-kind" }, data.kindLabel), data.count > 1 && /* @__PURE__ */ react.createElement("span", { className: "awr-node-count" }, "×", data.count), /* @__PURE__ */ react.createElement("span", { className: "awr-node-state" }, data.stateLabel)), /* @__PURE__ */ react.createElement("div", { className: "awr-node-title" }, data.title), shown !== "" && /* @__PURE__ */ react.createElement("div", { className: "awr-node-detail" }, shown), Array.from({ length: slots }, (_, index) => /* @__PURE__ */ react.createElement(Handle, {
		key: index,
		id: `out-${index}`,
		type: "source",
		position: Position.Right,
		isConnectable: false,
		style: { top: `${(index + 1) / (slots + 1) * 100}%` }
	})));
}
var nodeTypes = { run: RunNode };
function RunCanvas({ nodes, edges, selectedId, onSelect }) {
	const shown = react.useMemo(() => nodes.map((node) => ({
		...node,
		selected: node.id === selectedId
	})), [nodes, selectedId]);
	const renderedEdges = react.useMemo(() => spreadSourceHandles(edges), [edges]);
	return /* @__PURE__ */ react.createElement("div", { className: "awr-canvas" }, /* @__PURE__ */ react.createElement("style", null, style_default), /* @__PURE__ */ react.createElement("style", null, runCss), /* @__PURE__ */ react.createElement(index, {
		nodes: shown,
		edges: renderedEdges,
		nodeTypes,
		nodesDraggable: false,
		nodesConnectable: false,
		nodesFocusable: false,
		edgesFocusable: false,
		onNodeClick: (_, node) => onSelect(node.id),
		onPaneClick: () => onSelect(null),
		fitView: true,
		fitViewOptions: { padding: .22 },
		minZoom: .2,
		proOptions: { hideAttribution: false }
	}, /* @__PURE__ */ react.createElement(Background, {
		gap: 18,
		size: 1
	}), /* @__PURE__ */ react.createElement(Controls, { showInteractive: false })));
}
//#endregion
//#region
var ACTIVE_RUN = /* @__PURE__ */ new Set([
	"running",
	"waiting_gate",
	"waiting_children"
]);
var STATE_LABEL = {
	done: "已完成",
	current: "进行中",
	waiting: "等子 Agent",
	blocked: "阻塞",
	idle: "未走到"
};
function isActiveRun(detail) {
	return ACTIVE_RUN.has(detail.status);
}
/** 节点状态：阻塞/派发优先，其次"当前步"，再次"跑过"，最后"没走到" */
function progressOf(detail, nodeId) {
	const execs = detail.executions.filter((exec) => exec.nodeId === nodeId);
	const completed = execs.filter((exec) => exec.status === "completed").length;
	const last = execs[execs.length - 1];
	if (last?.status === "blocked") return {
		state: "blocked",
		count: completed
	};
	if (last?.status === "dispatched") return {
		state: "waiting",
		count: completed
	};
	if (detail.currentNode === nodeId) {
		if (isActiveRun(detail)) return {
			state: "current",
			count: completed
		};
		if (detail.status === "completed") return {
			state: "done",
			count: completed
		};
		if (detail.status === "failed" || detail.status === "stale") return {
			state: "blocked",
			count: completed
		};
	}
	if (completed > 0) return {
		state: "done",
		count: completed
	};
	return {
		state: "idle",
		count: 0
	};
}
/** 走过的边：完成的执行记录带 branchId 时走对应分支，否则走唯一后继 */
function traversedEdges(detail) {
	const ids = /* @__PURE__ */ new Set();
	for (const exec of detail.executions) {
		if (exec.status !== "completed") continue;
		ids.add(exec.branchId !== null ? `e-${exec.nodeId}-${exec.branchId}` : `e-${exec.nodeId}`);
	}
	return ids;
}
function buildRunGraph(detail) {
	const snapshot = detail.snapshot;
	const flow = snapshot === null ? void 0 : snapshot.flows[snapshot.rootFlowId];
	if (flow === void 0) return null;
	const base = canvasOf(flow);
	const traversed = traversedEdges(detail);
	return {
		nodes: base.nodes.map((node) => {
			const progress = progressOf(detail, node.id);
			const source = flow.nodes.find((candidate) => candidate.id === node.id);
			return {
				...node,
				type: "run",
				draggable: false,
				data: {
					title: node.data.title,
					kind: node.data.kind,
					kindLabel: typeLabel(node.data.kind),
					detail: source === void 0 ? "" : detailOf(source),
					state: progress.state,
					count: progress.count,
					stateLabel: STATE_LABEL[progress.state]
				}
			};
		}),
		edges: base.edges.map((edge) => {
			const walked = traversed.has(edge.id);
			return {
				...edge,
				selectable: false,
				style: walked ? {
					stroke: "var(--dsw-alias-brand-primary)",
					strokeWidth: 2
				} : {
					stroke: "var(--dsw-alias-border-l2)",
					strokeWidth: 1.2,
					strokeDasharray: "5 4"
				},
				labelStyle: walked ? { fill: "var(--dsw-alias-brand-primary)" } : void 0
			};
		}),
		flow
	};
}
//#endregion
//#region
var PHASE_TEXT = {
	running: "进行中",
	gate: "等人工确认",
	children: "等子 Agent",
	finished: "已完成",
	failed: "失败",
	stale: "停滞"
};
var EXEC_TEXT = {
	completed: {
		text: "完成",
		tone: "ok"
	},
	blocked: {
		text: "阻塞",
		tone: "bad"
	},
	limit_exceeded: {
		text: "超限逃生",
		tone: "warn"
	},
	dispatched: {
		text: "派发",
		tone: "warn"
	}
};
var PAGE_STYLE = {
	background: "var(--dsw-alias-bg-base, Canvas)",
	color: "var(--dsw-alias-label-primary, CanvasText)",
	minHeight: 420
};
function RunGraphPage({ onExit, sessionId }) {
	const [selected, setSelected] = react.useState(null);
	const [data, setData] = react.useState(null);
	const [error, setError] = react.useState(null);
	const [focusNode, setFocusNode] = react.useState(null);
	const [openExec, setOpenExec] = react.useState(null);
	const [tick, setTick] = react.useState(0);
	const selectedRef = react.useRef(null);
	selectedRef.current = selected;
	/** 上一轮的数据指纹：轮询没变化就不 setState，避免每 2 秒重渲染一次导致边标签抖动 */
	const lastKeyRef = react.useRef("");
	react.useEffect(() => {
		setSelected(null);
		setFocusNode(null);
		setOpenExec(null);
	}, [sessionId]);
	react.useEffect(() => {
		let cancelled = false;
		let inflight = null;
		const load = async () => {
			inflight?.abort();
			const controller = new AbortController();
			inflight = controller;
			const url = resolveEndpoint("aiworkflow/");
			if (sessionId !== void 0 && sessionId !== "") url.searchParams.set("session", sessionId);
			if (selectedRef.current !== null) url.searchParams.set("run", selectedRef.current);
			try {
				const response = await fetch(url, {
					signal: controller.signal,
					headers: { accept: "application/json" },
					cache: "no-store"
				});
				const body = await response.json();
				if (cancelled) return;
				if (body.ok === false) {
					setError(`读取失败（HTTP ${response.status}）`);
					return;
				}
				setError(null);
				const key = JSON.stringify({
					active: body.active,
					recent: body.recent,
					selectedId: body.selectedId,
					detail: body.detail
				});
				if (key === lastKeyRef.current) return;
				lastKeyRef.current = key;
				setData(body);
				if (selectedRef.current === null && typeof body.selectedId === "string") setSelected(body.selectedId);
			} catch (cause) {
				if (!cancelled && !controller.signal.aborted) setError(`无法连接插件 Host 半：${errorText$1(cause)}`);
			}
		};
		load();
		const timer = window.setInterval(() => {
			if (document.visibilityState !== "hidden") load();
		}, 2e3);
		return () => {
			cancelled = true;
			window.clearInterval(timer);
			inflight?.abort();
		};
	}, [
		selected,
		tick,
		sessionId
	]);
	const detail = data?.detail ?? null;
	const graph = react.useMemo(() => detail === null ? null : buildRunGraph(detail), [detail]);
	const runs = (data === null ? [] : dedupe([...data.active, ...data.recent])).filter((run) => run.parentRunId === null);
	const phase = detail === null ? null : phaseOf(detail);
	const executions = detail === null ? [] : detail.executions;
	const visible = focusNode === null ? executions : executions.filter((exec) => exec.nodeId === focusNode);
	const focused = openExec === null ? void 0 : executions.find((exec) => exec.id === openExec);
	const childRuns = detail === null ? [] : detail.children;
	const shownChildren = focusNode === null ? childRuns : childRuns.filter((child) => child.parentNode === focusNode);
	const rootFlow = detail?.snapshot === null || detail?.snapshot === void 0 ? void 0 : detail.snapshot.flows[detail.snapshot.rootFlowId];
	const pickNode = (nodeId) => {
		setFocusNode((current) => current === nodeId ? null : nodeId);
		setOpenExec(null);
	};
	return /* @__PURE__ */ react.createElement("div", {
		className: "awr-page",
		style: PAGE_STYLE
	}, /* @__PURE__ */ react.createElement("style", null, runCss), /* @__PURE__ */ react.createElement("header", { className: "awr-head" }, /* @__PURE__ */ react.createElement("span", { className: "awr-title" }, "运行图"), detail !== null && detail.parentRunId !== null && /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "awr-btn",
		onClick: () => {
			setSelected(detail.parentRunId);
			setFocusNode(null);
			setOpenExec(null);
		},
		title: "回到派发这个 child 的父 run"
	}, "← 父 run"), /* @__PURE__ */ react.createElement("span", { className: "awr-sub" }, detail === null ? "只读预览" : `${detail.flowName ?? detail.flowId} · ${detail.stepsUsed} 步`), phase !== null && /* @__PURE__ */ react.createElement("span", {
		className: "awr-run",
		"data-sel": "true",
		style: { cursor: "default" }
	}, /* @__PURE__ */ react.createElement("span", {
		className: "awr-dot",
		"data-phase": phase
	}), PHASE_TEXT[phase] ?? phase), /* @__PURE__ */ react.createElement("span", { className: "awr-spacer" }), /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "awr-btn",
		onClick: () => setTick((value) => value + 1)
	}, "刷新"), onExit !== void 0 && /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "awr-btn",
		onClick: onExit
	}, "返回会话")), runs.length > 0 && /* @__PURE__ */ react.createElement("div", { className: "awr-runs" }, runs.map((run) => /* @__PURE__ */ react.createElement("button", {
		type: "button",
		key: run.id,
		className: "awr-run",
		"data-sel": run.id === (data?.selectedId ?? selected) ? "true" : "false",
		title: `${run.flowName ?? run.flowId} · ${relTime(run.createdAt)}`,
		onClick: () => {
			setSelected(run.id);
			setFocusNode(null);
			setOpenExec(null);
		}
	}, /* @__PURE__ */ react.createElement("span", {
		className: "awr-dot",
		"data-phase": phaseOf(run)
	}), /* @__PURE__ */ react.createElement("span", { className: "awr-run-name" }, run.flowName ?? run.flowId), /* @__PURE__ */ react.createElement("span", null, relTime(run.createdAt))))), data === null && error === null ? /* @__PURE__ */ react.createElement("div", { className: "awr-empty" }, /* @__PURE__ */ react.createElement("b", null, "读取中…")) : error !== null && data === null ? /* @__PURE__ */ react.createElement("div", { className: "awr-empty" }, /* @__PURE__ */ react.createElement("b", null, "读取失败"), /* @__PURE__ */ react.createElement("span", null, error)) : data !== null && !data.available ? /* @__PURE__ */ react.createElement("div", { className: "awr-empty" }, /* @__PURE__ */ react.createElement("b", null, "还没有 aiworkflow 数据"), /* @__PURE__ */ react.createElement("span", null, data.reason ?? "先建一张流程图并在会话里跑一次，这里就会出现运行图。"), /* @__PURE__ */ react.createElement("code", null, data.dbPath)) : runs.length === 0 ? /* @__PURE__ */ react.createElement("div", { className: "awr-empty" }, /* @__PURE__ */ react.createElement("b", null, sessionId === void 0 ? "还没有 run" : "本会话还没有 run"), /* @__PURE__ */ react.createElement("span", null, sessionId === void 0 ? "在会话里让 Agent 跑一张流程图，运行状态会实时出现在这里。" : "在输入框左侧点「工作流」启动一张图，这里就会出现本会话的运行图。"), /* @__PURE__ */ react.createElement("code", null, data?.dbPath ?? "")) : /* @__PURE__ */ react.createElement("div", { className: "awr-body" }, graph === null ? /* @__PURE__ */ react.createElement("div", { className: "awr-empty" }, /* @__PURE__ */ react.createElement("b", null, "快照丢失"), /* @__PURE__ */ react.createElement("span", null, "这次 run 的快照不在库里（", detail?.snapshotHash ?? "", "），右侧轨迹仍可查看。")) : /* @__PURE__ */ react.createElement(RunCanvas, {
		nodes: graph.nodes,
		edges: graph.edges,
		selectedId: focusNode,
		onSelect: pickNode
	}), /* @__PURE__ */ react.createElement("aside", { className: "awr-rail" }, detail !== null && /* @__PURE__ */ react.createElement("div", { className: "awr-meta" }, detail.flowName ?? detail.flowId, detail.flowKind === "agent" && /* @__PURE__ */ react.createElement(react.Fragment, null, " ", /* @__PURE__ */ react.createElement("span", {
		className: "awr-chip",
		title: "这是一个子 Agent 配置"
	}, "子 Agent 配置")), detail.outcome !== null && !isActiveRun(detail) ? ` · ${detail.outcome === "fail" ? "未达成" : "达成"}` : "", /* @__PURE__ */ react.createElement("br", null), "开始 ", relTime(detail.createdAt), "（", clockTime(detail.createdAt), "）", detail.finishedAt !== null ? ` · 结束 ${clockTime(detail.finishedAt)}` : "", /* @__PURE__ */ react.createElement("br", null), "当前步 ", nodeLabel$1(rootFlow, detail.currentNode), detail.role !== null && /* @__PURE__ */ react.createElement(react.Fragment, null, /* @__PURE__ */ react.createElement("br", null), "角色 ", detail.role, detail.threadId !== null ? ` · 线程 ${detail.threadId}` : "", detail.parentIteration !== null ? ` · 第 ${detail.parentIteration} 轮` : "")), detail !== null && childRuns.length > 0 && /* @__PURE__ */ react.createElement("div", { className: "awr-card" }, /* @__PURE__ */ react.createElement("div", { className: "awr-card-title" }, "子运行（", shownChildren.length, "/", childRuns.length, "）", focusNode !== null ? ` · ${nodeLabel$1(rootFlow, focusNode)}` : ""), shownChildren.length === 0 ? /* @__PURE__ */ react.createElement("div", { className: "awr-card-hint" }, "该节点没有子运行；点上面的父节点可筛选。") : shownChildren.map((child) => /* @__PURE__ */ react.createElement("button", {
		type: "button",
		key: child.id,
		className: "awr-child",
		"data-sel": child.id === (data?.selectedId ?? selected) ? "true" : "false",
		onClick: () => {
			setSelected(child.id);
			setFocusNode(null);
			setOpenExec(null);
		},
		title: `${child.flowName ?? child.flowId} · ${child.parentNode ?? ""}`
	}, /* @__PURE__ */ react.createElement("span", {
		className: "awr-dot",
		"data-phase": phaseOf(child)
	}), /* @__PURE__ */ react.createElement("span", { className: "awr-run-name" }, child.flowName ?? child.flowId), child.flowKind === "agent" && /* @__PURE__ */ react.createElement("span", {
		className: "awr-chip",
		title: "子 Agent 配置"
	}, "配置"), child.parentNode !== null && /* @__PURE__ */ react.createElement("span", {
		className: "awr-child-node",
		title: child.parentNode
	}, nodeLabel$1(rootFlow, child.parentNode)), /* @__PURE__ */ react.createElement("span", null, child.role ?? "")))), detail !== null && (detail.artifacts ?? []).length > 0 && /* @__PURE__ */ react.createElement("div", { className: "awr-card" }, /* @__PURE__ */ react.createElement("div", { className: "awr-card-title" }, "产物（", (detail.artifacts ?? []).length, "）"), (detail.artifacts ?? []).map((artifact) => /* @__PURE__ */ react.createElement("div", {
		key: `${artifact.key}@${artifact.version}`,
		className: "awr-card-hint"
	}, /* @__PURE__ */ react.createElement("b", null, artifact.key), " v", artifact.version, artifact.path !== null ? ` · ${artifact.path}` : "", artifact.summary !== null ? ` · ${artifact.summary}` : ""))), detail?.pendingGate !== null && detail?.pendingGate !== void 0 && /* @__PURE__ */ react.createElement("div", { className: "awr-card" }, /* @__PURE__ */ react.createElement("div", { className: "awr-card-title" }, /* @__PURE__ */ react.createElement("span", {
		className: "awr-dot",
		"data-phase": "gate"
	}), "等人工确认"), /* @__PURE__ */ react.createElement("div", { className: "awr-card-q" }, detail.pendingGate.question), /* @__PURE__ */ react.createElement("div", { className: "awr-card-opts" }, detail.pendingGate.options.map((option) => /* @__PURE__ */ react.createElement("span", {
		key: option.id,
		className: "awr-opt"
	}, option.label))), /* @__PURE__ */ react.createElement("div", { className: "awr-card-hint" }, "在对话里直接答复即可（Agent 会代填），这块只读。")), /* @__PURE__ */ react.createElement("div", { className: "awr-card-title" }, "执行轨迹", focusNode !== null && /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "awr-btn",
		onClick: () => pickNode(null)
	}, "只看 ", nodeLabel$1(rootFlow, focusNode), " · 清除")), /* @__PURE__ */ react.createElement("ol", { className: "awr-trace" }, [...visible].reverse().map((exec, index) => {
		const chip = EXEC_TEXT[exec.status] ?? {
			text: exec.status,
			tone: "warn"
		};
		const branch = branchOf(rootFlow, exec.nodeId, exec.branchId);
		return /* @__PURE__ */ react.createElement("li", {
			key: exec.id,
			className: "awr-trace-item",
			"data-sel": openExec === exec.id ? "true" : "false",
			onClick: () => {
				setOpenExec(exec.id);
				setFocusNode(exec.nodeId);
			}
		}, /* @__PURE__ */ react.createElement("span", { className: "awr-trace-seq" }, visible.length - index), /* @__PURE__ */ react.createElement("span", { className: "awr-trace-body" }, /* @__PURE__ */ react.createElement("span", { className: "awr-trace-node" }, nodeLabel$1(rootFlow, exec.nodeId), /* @__PURE__ */ react.createElement("em", { className: "awr-trace-iter" }, "#", exec.iteration), /* @__PURE__ */ react.createElement("span", {
			className: "awr-chip",
			"data-tone": chip.tone
		}, chip.text)), /* @__PURE__ */ react.createElement("span", { className: "awr-trace-summary" }, exec.summary ?? ""), /* @__PURE__ */ react.createElement("span", { className: "awr-trace-sub" }, branch !== null && /* @__PURE__ */ react.createElement(react.Fragment, null, "走了「", branch, "」 · "), clockTime(exec.finishedAt ?? exec.startedAt))));
	})), focused !== void 0 && /* @__PURE__ */ react.createElement("pre", { className: "awr-payload" }, JSON.stringify(focused.payload, null, 2)))));
}
function branchOf(flow, nodeId, branchId) {
	if (branchId === null || flow === void 0) return null;
	const branch = flow.nodes.find((candidate) => candidate.id === nodeId)?.branches?.find((candidate) => candidate.id === branchId);
	if (branch === void 0) return branchId;
	return branch.condition === "*" ? "默认" : branch.condition;
}
function dedupe(runs) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const run of runs) {
		if (seen.has(run.id)) continue;
		seen.add(run.id);
		out.push(run);
	}
	return out;
}
function errorText$1(error) {
	return error instanceof Error ? error.message : String(error);
}
//#endregion
//#region
var open$1 = false;
var listeners$1 = /* @__PURE__ */ new Set();
var runOverlay = {
	subscribe(listener) {
		listeners$1.add(listener);
		return () => {
			listeners$1.delete(listener);
		};
	},
	getSnapshot() {
		return open$1;
	},
	set(next) {
		if (open$1 === next) return;
		open$1 = next;
		for (const listener of listeners$1) listener();
	},
	toggle() {
		runOverlay.set(!open$1);
	}
};
function RunGraphOverlay({ store }) {
	const visible = react.useSyncExternalStore(runOverlay.subscribe, runOverlay.getSnapshot);
	const snap = react.useSyncExternalStore(store.subscribe, store.getSnapshot);
	const close = react.useCallback(() => runOverlay.set(false), []);
	react.useEffect(() => {
		if (!visible) return void 0;
		const onKey = (event) => {
			if (event.key === "Escape") close();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [visible, close]);
	if (!visible) return null;
	return /* @__PURE__ */ react.createElement("div", {
		className: "awr-backdrop",
		onClick: close,
		role: "presentation"
	}, /* @__PURE__ */ react.createElement("style", null, runCss), /* @__PURE__ */ react.createElement("div", {
		className: "awr-dialog",
		role: "dialog",
		"aria-label": "运行图",
		onClick: (event) => event.stopPropagation()
	}, /* @__PURE__ */ react.createElement(RunGraphPage, {
		sessionId: snap.sessionId ?? void 0,
		onExit: close
	}), /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "awr-dialog-close",
		onClick: close,
		title: "关闭"
	}, "✕")));
}
//#endregion
//#region
var css = `
.awp-pill{display:inline-flex;align-items:center;gap:7px;height:26px;padding:0 10px;border-radius:999px;
  border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);
  font-size:12px;font-family:inherit;cursor:pointer;max-width:300px;min-width:0;
  transition:background .12s ease,border-color .12s ease,color .12s ease}
.awp-pill:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.awp-pill[data-open="true"]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}
.awp-pill-name{font-weight:550;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.awp-pill-sep{width:1px;height:11px;background:var(--dsw-alias-border-l2);flex:none}
.awp-pill-sub{font-size:11.5px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.awp-pill-count{font-size:11px;font-variant-numeric:tabular-nums;opacity:.85;flex:none}

.awp-dot{width:7px;height:7px;border-radius:50%;flex:none;background:var(--dsw-alias-state-idle-primary)}
.awp-dot[data-phase="running"]{background:var(--dsw-alias-brand-primary);animation:awp-pulse 1.7s ease-out infinite}
.awp-dot[data-phase="gate"]{background:var(--dsw-alias-state-warn-primary)}
.awp-dot[data-phase="children"]{background:var(--dsw-alias-state-idle-primary)}
.awp-dot[data-phase="finished"]{background:var(--dsw-alias-state-success-primary)}
.awp-dot[data-phase="failed"]{background:var(--dsw-alias-state-error-primary)}
.awp-dot[data-phase="stale"]{background:var(--dsw-alias-state-warn-primary);opacity:.6}
@keyframes awp-pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--dsw-alias-brand-primary) 45%,transparent)}
  70%{box-shadow:0 0 0 6px transparent}100%{box-shadow:0 0 0 0 transparent}}

.awp-panel{position:fixed;top:54px;right:18px;width:404px;max-height:min(74vh,760px);display:flex;flex-direction:column;
  background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);font-family:inherit;
  border:1px solid var(--dsw-alias-border-l1);border-radius:16px;overflow:hidden;z-index:60;
  font-size:13px;line-height:1.5;box-shadow:0 24px 60px rgba(15,23,42,.22),0 2px 10px rgba(15,23,42,.10);
  /* 全帧浮层本身是 click-through，占用者必须主动收回指针事件 */
  pointer-events:auto}
.awp-head{display:flex;align-items:center;gap:8px;padding:12px 14px 8px}
.awp-title{font-weight:600;font-size:13px;letter-spacing:.01em}
.awp-spacer{flex:1}
.awp-iconbtn{width:26px;height:26px;display:grid;place-items:center;border-radius:8px;border:1px solid transparent;
  background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:15px;line-height:1;font-family:inherit}
.awp-iconbtn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.awp-textbtn{height:22px;padding:0 8px;border-radius:7px;border:1px solid var(--dsw-alias-border-l1);
  background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;cursor:pointer}
.awp-textbtn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.awp-chip{display:inline-flex;align-items:center;gap:5px;height:20px;padding:0 8px;border-radius:999px;font-size:11px;
  font-weight:600;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);
  color:var(--dsw-alias-label-secondary);white-space:nowrap;flex:none}
.awp-chip[data-phase="running"],.awp-chip[data-phase="gate"]{color:var(--dsw-alias-brand-primary)}
.awp-chip[data-phase="gate"]{color:var(--dsw-alias-state-warn-primary)}
.awp-chip[data-phase="finished"]{color:var(--dsw-alias-state-success-primary)}
.awp-chip[data-phase="failed"]{color:var(--dsw-alias-state-error-primary)}

.awp-runs{display:flex;gap:6px;padding:0 14px 10px;overflow-x:auto;scrollbar-width:none}
.awp-runs::-webkit-scrollbar{display:none}
.awp-run{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:9px;font-size:11.5px;
  border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);
  color:var(--dsw-alias-label-secondary);cursor:pointer;white-space:nowrap;flex:none;font-family:inherit}
.awp-run:hover{color:var(--dsw-alias-label-primary)}
.awp-run[data-sel="true"]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}
.awp-run-name{max-width:150px;overflow:hidden;text-overflow:ellipsis}

.awp-body{padding:0 14px 12px;overflow-y:auto;display:flex;flex-direction:column;gap:12px}
.awp-body::-webkit-scrollbar{width:8px}
.awp-body::-webkit-scrollbar-thumb{background:var(--dsw-alias-border-l2);border-radius:8px}

.awp-hero{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:12px;background:var(--dsw-alias-bg-layer-1);
  display:flex;flex-direction:column;gap:7px}
.awp-kicker{font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--dsw-alias-label-secondary);font-weight:600}
.awp-node{font-size:16px;font-weight:650;line-height:1.3;display:flex;align-items:center;gap:8px;flex-wrap:wrap;word-break:break-word}
.awp-type{font-size:10px;font-weight:600;padding:3px 6px;border-radius:6px;text-transform:uppercase;letter-spacing:.04em;
  background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1)}
.awp-instr{color:var(--dsw-alias-label-secondary);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;
  overflow:hidden;white-space:pre-wrap;word-break:break-word}
.awp-meta{display:flex;gap:12px;flex-wrap:wrap;font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.awp-meta b{color:var(--dsw-alias-label-primary);font-weight:600;font-variant-numeric:tabular-nums}

.awp-section{font-size:11px;font-weight:600;color:var(--dsw-alias-label-secondary);letter-spacing:.02em}
.awp-path{display:flex;align-items:center;overflow-x:auto;padding:1px 0 3px;scrollbar-width:none}
.awp-path::-webkit-scrollbar{display:none}
.awp-step{display:flex;align-items:center;flex:none}
.awp-step-pill{display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border-radius:999px;font-size:11.5px;
  border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);max-width:170px}
.awp-step-pill em{font-style:normal;font-size:10px;opacity:.75}
.awp-step-pill span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.awp-step[data-current="true"] .awp-step-pill{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}
.awp-link{width:12px;height:1px;background:var(--dsw-alias-border-l2);flex:none}

.awp-trace{display:flex;flex-direction:column;gap:1px}
.awp-row{display:flex;gap:8px;padding:6px;border-radius:8px;cursor:pointer;border:1px solid transparent;align-items:flex-start}
.awp-row:hover{background:var(--dsw-alias-bg-layer-2)}
.awp-row[data-open="true"]{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l1)}
.awp-row-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.awp-row-top{display:flex;align-items:center;gap:6px;min-width:0}
.awp-row-name{font-weight:550;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.awp-row-sub{font-size:11px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.awp-seq{font-size:10px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary);width:18px;text-align:right;flex:none;padding-top:3px}
.awp-tag{font-size:9.5px;font-weight:600;padding:2px 5px;border-radius:5px;flex:none;
  background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1)}
.awp-tag[data-tone="ok"],.awp-tag[data-tone="done"]{color:var(--dsw-alias-state-success-primary)}
.awp-tag[data-tone="bad"],.awp-tag[data-tone="blocked"]{color:var(--dsw-alias-state-error-primary)}
.awp-tag[data-tone="warn"],.awp-tag[data-tone="partial"],.awp-tag[data-tone="limit"],.awp-tag[data-tone="dispatched"]{color:var(--dsw-alias-state-warn-primary)}
.awp-pre{margin:5px 0 0;padding:8px;border-radius:8px;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1.45;max-height:180px;overflow:auto;
  white-space:pre-wrap;word-break:break-all;color:var(--dsw-alias-label-secondary)}

.awp-gate{border:1px solid var(--dsw-alias-state-warn-primary);border-radius:12px;padding:10px 12px;
  background:var(--dsw-alias-bg-layer-1);display:flex;flex-direction:column;gap:6px}
.awp-gate-head{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:var(--dsw-alias-state-warn-primary)}
.awp-gate-q{font-weight:600;word-break:break-word}
.awp-gate-hint{font-size:11px;color:var(--dsw-alias-label-secondary)}
.awp-opts{display:flex;gap:6px;flex-wrap:wrap}
.awp-opt{padding:4px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);
  color:var(--dsw-alias-label-primary);font-size:11.5px;font-family:inherit;cursor:default}

.awp-empty{padding:26px 18px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;
  color:var(--dsw-alias-label-secondary)}
.awp-empty b{color:var(--dsw-alias-label-primary);font-weight:600;font-size:13px}
.awp-empty p{margin:0;font-size:12px;max-width:300px}
.awp-empty code{font-family:ui-monospace,Menlo,monospace;font-size:11px;word-break:break-all;
  background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:5px 8px;max-width:100%}

.awp-foot{display:flex;align-items:center;gap:8px;padding:8px 14px;border-top:1px solid var(--dsw-alias-border-l1);
  font-size:10.5px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1)}
.awp-mono{font-family:ui-monospace,Menlo,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* 输入框左侧：工作流选择入口 */
.awp-pickerbtn{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 9px;border-radius:8px;
  border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);
  font:inherit;font-size:11.5px;cursor:pointer;white-space:nowrap}
.awp-pickerbtn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);
  border-color:var(--dsw-alias-border-l2)}

/* 选择弹层 */
.awp-modal-backdrop{position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;
  padding:24px;background:color-mix(in srgb,var(--dsw-alias-bg-base) 55%,transparent);pointer-events:auto}
.awp-modal{width:min(560px,100%);max-height:min(70vh,560px);display:flex;flex-direction:column;overflow:hidden;
  border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-overlay);
  color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;
  box-shadow:0 24px 60px rgba(15,23,42,.3)}
.awp-modal-head{display:flex;align-items:baseline;gap:8px;padding:12px 14px;font-weight:600;
  border-bottom:1px solid var(--dsw-alias-border-l1)}
.awp-modal-sub{font-size:11px;font-weight:400;color:var(--dsw-alias-label-secondary)}
.awp-modal-body{overflow-y:auto;padding:8px}
.awp-pick-list{display:flex;flex-direction:column;gap:2px}
.awp-pick-item{display:flex;flex-direction:column;gap:2px;align-items:flex-start;width:100%;padding:8px 10px;
  border-radius:9px;border:1px solid transparent;background:transparent;color:inherit;font:inherit;
  text-align:left;cursor:pointer}
.awp-pick-item:hover{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l1)}
.awp-pick-name{font-weight:550;font-size:13px}
.awp-pick-meta{font-size:11px;color:var(--dsw-alias-label-secondary)}
`;
function Styles() {
	return /* @__PURE__ */ react.createElement("style", null, css);
}
function Dot({ phase }) {
	return /* @__PURE__ */ react.createElement("span", {
		className: "awp-dot",
		"data-phase": phase ?? "idle"
	});
}
//#endregion
//#region
function ProgressPanel({ store, t }) {
	const snap = react.useSyncExternalStore(store.subscribe, store.getSnapshot);
	const [openExec, setOpenExec] = react.useState(null);
	if (!snap.open) return null;
	const detail = snap.detail;
	const flow = rootFlowOf(detail?.snapshot ?? null);
	const phase = detail === null ? null : phaseOf(detail);
	const path = detail === null ? [] : buildPath(detail);
	const live = phase !== null && isLive(phase);
	const currentNodeId = detail?.currentNode ?? null;
	const currentNode = currentNodeId === null ? void 0 : flow?.nodes.find((n) => n.id === currentNodeId);
	const heroTitle = detail === null ? "" : currentNodeId === null ? detail.flowName ?? detail.flowId : nodeLabel$1(flow, currentNodeId);
	const executions = detail === null ? [] : detail.executions;
	const rows = [...executions].reverse();
	const runs = dedupeRuns([...snap.active, ...snap.recent]);
	/** 放弃当前 run：把 root 及未终结 child 一起判失败（引擎不按时间自动清僵尸 run） */
	const abandon = async (runId, label) => {
		if (!window.confirm(`放弃「${label}」（${runId}）？当前 run 与未完成的子任务会立即判失败，不可恢复。`)) return;
		try {
			const body = await (await fetch(resolveEndpoint("aiworkflow/runs/abandon"), {
				method: "POST",
				headers: {
					"content-type": "application/json",
					accept: "application/json"
				},
				body: JSON.stringify({ runId })
			})).json();
			if (body.ok !== true || body.result?.error === true) window.alert(body.result?.what ?? "放弃失败，请刷新后重试");
		} catch (cause) {
			window.alert(`无法连接插件 Host 半：${cause instanceof Error ? cause.message : String(cause)}`);
		}
		store.refresh();
	};
	return /* @__PURE__ */ react.createElement(react.Fragment, null, /* @__PURE__ */ react.createElement(Styles, null), /* @__PURE__ */ react.createElement("aside", {
		className: "awp-panel",
		role: "dialog",
		"aria-label": t("title")
	}, /* @__PURE__ */ react.createElement("header", { className: "awp-head" }, /* @__PURE__ */ react.createElement("span", { className: "awp-title" }, t("title")), phase !== null && /* @__PURE__ */ react.createElement("span", {
		className: "awp-chip",
		"data-phase": phase
	}, /* @__PURE__ */ react.createElement(Dot, { phase }), t(phaseKey(phase))), /* @__PURE__ */ react.createElement("span", { className: "awp-spacer" }), live && detail !== null && /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "awp-textbtn",
		onClick: () => void abandon(detail.id, detail.flowName ?? detail.flowId),
		title: "放弃当前 run（连同未完成的子任务）"
	}, t("panel.abandon")), /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "awp-textbtn",
		onClick: () => runOverlay.set(true),
		title: t("panel.runs")
	}, t("panel.runs")), /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "awp-iconbtn",
		onClick: () => store.setOpen(false),
		title: t("title")
	}, "✕")), runs.length > 0 && /* @__PURE__ */ react.createElement("div", {
		className: "awp-runs",
		"aria-label": t("run.select")
	}, runs.map((run) => /* @__PURE__ */ react.createElement("button", {
		type: "button",
		key: run.id,
		className: "awp-run",
		"data-sel": snap.selectedId === run.id ? "true" : "false",
		onClick: () => store.select(run.id),
		title: `${run.flowName ?? run.flowId} · ${relTime(run.createdAt)}`
	}, /* @__PURE__ */ react.createElement(Dot, { phase: phaseOf(run) }), /* @__PURE__ */ react.createElement("span", { className: "awp-run-name" }, run.flowName ?? run.flowId), /* @__PURE__ */ react.createElement("span", null, relTime(run.createdAt))))), /* @__PURE__ */ react.createElement("div", { className: "awp-body" }, snap.updatedAt === null && snap.error === null ? /* @__PURE__ */ react.createElement("div", { className: "awp-empty" }, /* @__PURE__ */ react.createElement("b", null, t("loading"))) : !snap.available ? /* @__PURE__ */ react.createElement(EmptyState, {
		title: snap.error !== null ? t("empty.error") : t("empty.noDb"),
		hint: snap.error ?? snap.reason ?? t("empty.noDbHint"),
		dbPath: snap.dbPath,
		label: t("empty.dbPath"),
		endpoint: snap.endpoint
	}) : detail === null ? /* @__PURE__ */ react.createElement(EmptyState, {
		title: t("empty.noRuns"),
		hint: t("empty.noRunsHint"),
		dbPath: snap.dbPath,
		label: t("empty.dbPath")
	}) : /* @__PURE__ */ react.createElement(react.Fragment, null, /* @__PURE__ */ react.createElement("section", { className: "awp-hero" }, /* @__PURE__ */ react.createElement("div", { className: "awp-kicker" }, live ? t("hero.current") : t("hero.last")), /* @__PURE__ */ react.createElement("div", { className: "awp-node" }, /* @__PURE__ */ react.createElement("span", null, heroTitle), currentNode !== void 0 && /* @__PURE__ */ react.createElement("span", { className: "awp-type" }, currentNode.type)), currentNode !== void 0 && /* @__PURE__ */ react.createElement(NodeDetail, { node: currentNode }), /* @__PURE__ */ react.createElement("div", { className: "awp-meta" }, /* @__PURE__ */ react.createElement("span", null, t("hero.steps"), " ", /* @__PURE__ */ react.createElement("b", null, detail.stepsUsed)), /* @__PURE__ */ react.createElement("span", null, t("hero.elapsed"), " ", /* @__PURE__ */ react.createElement("b", null, duration(elapsedOf(detail)))), /* @__PURE__ */ react.createElement("span", null, t("hero.started"), " ", /* @__PURE__ */ react.createElement("b", null, clockTime(detail.createdAt))))), detail.pendingGate !== null && /* @__PURE__ */ react.createElement("section", { className: "awp-gate" }, /* @__PURE__ */ react.createElement("div", { className: "awp-gate-head" }, /* @__PURE__ */ react.createElement(Dot, { phase: "gate" }), t("gate.title")), /* @__PURE__ */ react.createElement("div", { className: "awp-gate-q" }, detail.pendingGate.question || nodeLabel$1(flow, detail.pendingGate.nodeId)), /* @__PURE__ */ react.createElement("div", { className: "awp-opts" }, detail.pendingGate.options.map((option) => /* @__PURE__ */ react.createElement("span", {
		className: "awp-opt",
		key: option.id
	}, option.label))), /* @__PURE__ */ react.createElement("div", { className: "awp-gate-hint" }, t("gate.hint"))), path.length > 0 && /* @__PURE__ */ react.createElement("section", null, /* @__PURE__ */ react.createElement("div", { className: "awp-section" }, t("path")), /* @__PURE__ */ react.createElement("div", { className: "awp-path" }, path.map((step, index) => /* @__PURE__ */ react.createElement("div", {
		className: "awp-step",
		key: `${step.nodeId}-${String(index)}`,
		"data-current": index === path.length - 1 ? "true" : "false"
	}, index > 0 && /* @__PURE__ */ react.createElement("span", { className: "awp-link" }), /* @__PURE__ */ react.createElement("span", { className: "awp-step-pill" }, /* @__PURE__ */ react.createElement(Dot, { phase: stepTone(step.statuses) }), /* @__PURE__ */ react.createElement("span", null, step.label), step.count > 1 && /* @__PURE__ */ react.createElement("em", null, "×", step.count)))))), /* @__PURE__ */ react.createElement("section", null, /* @__PURE__ */ react.createElement("div", { className: "awp-section" }, t("trace")), rows.length === 0 ? /* @__PURE__ */ react.createElement("div", { className: "awp-gate-hint" }, t("trace.empty")) : /* @__PURE__ */ react.createElement("div", { className: "awp-trace" }, rows.map((exec, rowIndex) => {
		const tone = executionTone(exec).key;
		const branch = branchLabel(flow, exec.nodeId, exec.branchId);
		const summary = oneLine(exec.summary, 120);
		return /* @__PURE__ */ react.createElement("div", {
			className: "awp-row",
			key: exec.id,
			"data-open": openExec === exec.id ? "true" : "false",
			onClick: () => setOpenExec(openExec === exec.id ? null : exec.id),
			title: t("payload.hint"),
			role: "button",
			tabIndex: 0,
			onKeyDown: (event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					setOpenExec(openExec === exec.id ? null : exec.id);
				}
			}
		}, /* @__PURE__ */ react.createElement("span", { className: "awp-seq" }, executions.length - rowIndex), /* @__PURE__ */ react.createElement("span", { className: "awp-row-main" }, /* @__PURE__ */ react.createElement("span", { className: "awp-row-top" }, /* @__PURE__ */ react.createElement("span", { className: "awp-row-name" }, nodeLabel$1(flow, exec.nodeId)), /* @__PURE__ */ react.createElement("span", { className: "awp-tag" }, "#", exec.iteration), branch !== null && /* @__PURE__ */ react.createElement("span", { className: "awp-tag" }, branch)), /* @__PURE__ */ react.createElement("span", { className: "awp-row-sub" }, summary !== "" ? summary : clockTime(exec.finishedAt ?? exec.startedAt)), openExec === exec.id && /* @__PURE__ */ react.createElement("pre", { className: "awp-pre" }, JSON.stringify(exec.payload, null, 2))), /* @__PURE__ */ react.createElement("span", {
			className: "awp-tag",
			"data-tone": tone
		}, exec.status));
	}))))), detail !== null && /* @__PURE__ */ react.createElement("footer", { className: "awp-foot" }, /* @__PURE__ */ react.createElement("span", { className: "awp-mono" }, detail.id), /* @__PURE__ */ react.createElement("span", { className: "awp-spacer" }), snap.updatedAt !== null && /* @__PURE__ */ react.createElement("span", null, t("foot.updated"), " ", clockTime(new Date(snap.updatedAt).toISOString())))));
}
function NodeDetail({ node }) {
	const text = nodeText(node);
	if (text === null) return null;
	return /* @__PURE__ */ react.createElement("div", { className: "awp-instr" }, text);
}
/** 各节点类型只展示对"当下在干什么"最有信息量的那一行 */
function nodeText(node) {
	switch (node.type) {
		case "prompt": return oneLine(node.instruction, 260);
		case "gate": return oneLine(node.question, 260);
		case "tool": return `工具 · ${node.toolName}`;
		case "subagent": return oneLine(node.extraPrompt, 220) || `子 Agent · ${node.mode}`;
		case "join": return oneLine(node.aggregateInstruction, 220);
		case "end": return node.outcome === "fail" ? "以失败结束" : "以成功结束";
		default: return null;
	}
}
function stepTone(statuses) {
	if (statuses.includes("blocked")) return "failed";
	if (statuses.every((status) => status === "completed")) return "finished";
	return "running";
}
function dedupeRuns(runs) {
	const seen = /* @__PURE__ */ new Set();
	const unique = [];
	for (const run of runs) {
		if (seen.has(run.id)) continue;
		seen.add(run.id);
		unique.push(run);
	}
	return unique.slice(0, 8);
}
function EmptyState({ title, hint, dbPath, label, endpoint }) {
	return /* @__PURE__ */ react.createElement("div", { className: "awp-empty" }, /* @__PURE__ */ react.createElement("svg", {
		width: "34",
		height: "34",
		viewBox: "0 0 64 64",
		"aria-hidden": "true"
	}, /* @__PURE__ */ react.createElement("circle", {
		cx: "20",
		cy: "44",
		r: "5",
		fill: "currentColor",
		opacity: "0.35"
	}), /* @__PURE__ */ react.createElement("circle", {
		cx: "44",
		cy: "20",
		r: "5",
		fill: "currentColor",
		opacity: "0.35"
	}), /* @__PURE__ */ react.createElement("path", {
		d: "M24 41 L40 23",
		stroke: "currentColor",
		strokeWidth: "3",
		strokeLinecap: "round",
		opacity: "0.35",
		fill: "none"
	})), /* @__PURE__ */ react.createElement("b", null, title), /* @__PURE__ */ react.createElement("p", null, hint), dbPath !== "" && /* @__PURE__ */ react.createElement("code", null, label, ": ", dbPath), endpoint !== void 0 && endpoint !== "" && dbPath === "" && /* @__PURE__ */ react.createElement("code", null, endpoint));
}
//#endregion
//#region
function ProgressPill({ store, t, sessionId }) {
	const snap = react.useSyncExternalStore(store.subscribe, store.getSnapshot);
	react.useEffect(() => {
		if (typeof sessionId === "string" && sessionId !== "") store.setSession(sessionId);
	}, [store, sessionId]);
	const detail = snap.detail;
	const run = detail ?? snap.active[0] ?? snap.recent[0] ?? null;
	if (run === null) return null;
	const flow = rootFlowOf(detail?.snapshot ?? null);
	const phase = run === null ? null : phaseOf(run);
	const nodeId = run?.currentNode ?? null;
	const nodeName = nodeId === null ? "" : nodeLabel$1(flow, nodeId);
	const live = phase !== null && isLive(phase);
	return /* @__PURE__ */ react.createElement(react.Fragment, null, /* @__PURE__ */ react.createElement(Styles, null), /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "awp-pill",
		"data-open": snap.open ? "true" : "false",
		onClick: () => store.toggle(),
		title: t("btn.open"),
		"aria-expanded": snap.open
	}, /* @__PURE__ */ react.createElement(Dot, { phase }), run === null ? /* @__PURE__ */ react.createElement("span", { className: "awp-pill-name" }, t("idle")) : live ? /* @__PURE__ */ react.createElement(react.Fragment, null, /* @__PURE__ */ react.createElement("span", { className: "awp-pill-name" }, run.flowName ?? run.flowId), /* @__PURE__ */ react.createElement("span", { className: "awp-pill-sep" }), /* @__PURE__ */ react.createElement("span", { className: "awp-pill-sub" }, nodeName === "" ? t(phaseKey(phase)) : nodeName), /* @__PURE__ */ react.createElement("span", { className: "awp-pill-count" }, run.stepsUsed, " ", t("steps"))) : /* @__PURE__ */ react.createElement(react.Fragment, null, /* @__PURE__ */ react.createElement("span", { className: "awp-pill-name" }, run.flowName ?? run.flowId), /* @__PURE__ */ react.createElement("span", { className: "awp-pill-sep" }), /* @__PURE__ */ react.createElement("span", { className: "awp-pill-sub" }, t(phaseKey(phase))))));
}
//#endregion
//#region
/** 启动列表只留主流程：子 Agent 配置没有「独立跑一遍」的语义，混进来会建出无意义的 run */
function startableFlows(flows) {
	return flows.filter((flow) => flow.kind !== "agent");
}
var open = false;
var connection = null;
var listeners = /* @__PURE__ */ new Set();
var pickerStore = {
	subscribe(listener) {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	},
	getSnapshot() {
		return open;
	},
	set(next) {
		if (open === next) return;
		open = next;
		for (const listener of listeners) listener();
	}
};
/** 输入框左侧的入口按钮（conversation.input.left） */
function WorkflowPickerButton(props) {
	const draft = typeof props?.useInput === "function" ? props.useInput((state) => state?.draft ?? "") : "";
	const onClick = () => {
		connection = {
			sessionId: typeof props?.sessionId === "string" ? props.sessionId : "",
			draft: typeof draft === "string" ? draft : "",
			actions: props?.inputActions ?? null
		};
		pickerStore.set(true);
	};
	return /* @__PURE__ */ react.createElement(react.Fragment, null, /* @__PURE__ */ react.createElement(Styles, null), /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "awp-pickerbtn",
		onClick,
		title: "启动一个工作流"
	}, /* @__PURE__ */ react.createElement("svg", {
		width: "13",
		height: "13",
		viewBox: "0 0 24 24",
		"aria-hidden": "true"
	}, /* @__PURE__ */ react.createElement("path", {
		d: "M5 7h5m4 0h5M7.5 9v6m9-6v6",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "1.8",
		strokeLinecap: "round"
	}), /* @__PURE__ */ react.createElement("rect", {
		x: "3",
		y: "4",
		width: "5",
		height: "5",
		rx: "1.4",
		fill: "currentColor"
	}), /* @__PURE__ */ react.createElement("rect", {
		x: "16",
		y: "4",
		width: "5",
		height: "5",
		rx: "1.4",
		fill: "currentColor",
		opacity: "0.55"
	}), /* @__PURE__ */ react.createElement("rect", {
		x: "9.5",
		y: "15",
		width: "5",
		height: "5",
		rx: "1.4",
		fill: "currentColor",
		opacity: "0.9"
	})), /* @__PURE__ */ react.createElement("span", null, "工作流")));
}
/** 选择弹层（shell.overlay） */
function WorkflowPickerDialog({ onStarted }) {
	const visible = react.useSyncExternalStore(pickerStore.subscribe, pickerStore.getSnapshot);
	const [flows, setFlows] = react.useState(null);
	const [error, setError] = react.useState(null);
	const [busy, setBusy] = react.useState(null);
	react.useEffect(() => {
		if (!visible) return;
		let alive = true;
		setFlows(null);
		setError(null);
		setBusy(null);
		fetch(resolveEndpoint("aiworkflow/flows?kind=flow"), {
			headers: { accept: "application/json" },
			cache: "no-store"
		}).then((response) => response.json()).then((body) => {
			if (!alive) return;
			if (body.ok !== true) {
				setError(body.error?.message ?? "读取流程图列表失败");
				return;
			}
			setFlows(startableFlows(Array.isArray(body.flows) ? body.flows : []));
		}).catch((cause) => {
			if (alive) setError(cause instanceof Error ? cause.message : String(cause));
		});
		return () => {
			alive = false;
		};
	}, [visible]);
	react.useEffect(() => {
		if (!visible) return void 0;
		const onKey = (event) => {
			if (event.key === "Escape") pickerStore.set(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [visible]);
	if (!visible) return null;
	const start = async (flow) => {
		setBusy(flow.id);
		setError(null);
		try {
			const body = await (await fetch(resolveEndpoint("aiworkflow/runs"), {
				method: "POST",
				headers: {
					"content-type": "application/json",
					accept: "application/json"
				},
				body: JSON.stringify({
					flowId: flow.id,
					sessionId: connection?.sessionId ?? "",
					note: connection?.draft ?? ""
				})
			})).json();
			if (body.ok !== true) {
				setError(body.error?.message ?? "启动失败");
				setBusy(null);
				return;
			}
			if (body.result?.error === true) {
				setError(body.result.what ?? "启动失败");
				setBusy(null);
				return;
			}
			if (connection !== null && connection.draft.trim() !== "") try {
				connection.actions?.setDraft?.("");
			} catch {}
			pickerStore.set(false);
			onStarted?.();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
			setBusy(null);
		}
	};
	return /* @__PURE__ */ react.createElement(react.Fragment, null, /* @__PURE__ */ react.createElement(Styles, null), /* @__PURE__ */ react.createElement("div", {
		className: "awp-modal-backdrop",
		onClick: () => pickerStore.set(false),
		role: "presentation"
	}, /* @__PURE__ */ react.createElement("div", {
		className: "awp-modal",
		role: "dialog",
		"aria-label": "启动工作流",
		onClick: (event) => event.stopPropagation()
	}, /* @__PURE__ */ react.createElement("header", { className: "awp-modal-head" }, /* @__PURE__ */ react.createElement("span", null, "启动工作流"), /* @__PURE__ */ react.createElement("span", { className: "awp-modal-sub" }, "选中即创建 run；输入框里的内容会一并带给 Agent"), /* @__PURE__ */ react.createElement("span", { className: "awp-spacer" }), /* @__PURE__ */ react.createElement("button", {
		type: "button",
		className: "awp-iconbtn",
		onClick: () => pickerStore.set(false)
	}, "✕")), /* @__PURE__ */ react.createElement("div", { className: "awp-modal-body" }, error !== null && /* @__PURE__ */ react.createElement("div", {
		className: "awp-banner",
		"data-kind": "error"
	}, error), flows === null ? /* @__PURE__ */ react.createElement("div", { className: "awp-empty" }, /* @__PURE__ */ react.createElement("b", null, "读取中…")) : flows.length === 0 ? /* @__PURE__ */ react.createElement("div", { className: "awp-empty" }, /* @__PURE__ */ react.createElement("b", null, "还没有可启动的流程"), /* @__PURE__ */ react.createElement("p", null, "子 Agent 配置只能被主流程引用，不能单独启动；先去左侧「可视化工作流」建一张主流程。")) : /* @__PURE__ */ react.createElement("div", { className: "awp-pick-list" }, flows.map((flow) => /* @__PURE__ */ react.createElement("button", {
		type: "button",
		key: flow.id,
		className: "awp-pick-item",
		disabled: busy !== null,
		onClick: () => void start(flow)
	}, /* @__PURE__ */ react.createElement("span", { className: "awp-pick-name" }, flow.name), /* @__PURE__ */ react.createElement("span", { className: "awp-pick-meta" }, busy === flow.id ? "启动中…" : `${flow.id} · ${relTime(flow.updatedAt)}`))))))));
}
//#endregion
//#region
var ENDPOINT = "aiworkflow/";
var OPEN_INTERVAL = 2e3;
var CLOSED_INTERVAL = 6e3;
function createProgressStore() {
	let state = {
		open: false,
		loading: true,
		available: false,
		reason: null,
		active: [],
		recent: [],
		detail: null,
		selectedId: null,
		sessionId: null,
		dbPath: "",
		updatedAt: null,
		error: null,
		endpoint: ""
	};
	const listeners = /* @__PURE__ */ new Set();
	let timer = null;
	let inflight = null;
	let disposed = false;
	let polling = false;
	const publish = (patch) => {
		state = {
			...state,
			...patch
		};
		for (const listener of listeners) listener();
	};
	const clearTimer = () => {
		if (timer !== null) {
			clearTimeout(timer);
			timer = null;
		}
	};
	const schedule = () => {
		clearTimer();
		if (disposed || !polling) return;
		timer = setTimeout(() => {
			timer = null;
			tick();
		}, state.open ? OPEN_INTERVAL : CLOSED_INTERVAL);
	};
	const load = async () => {
		if (disposed) return;
		inflight?.abort();
		const controller = new AbortController();
		inflight = controller;
		const url = resolveEndpoint(ENDPOINT);
		if (state.sessionId !== null) url.searchParams.set("session", state.sessionId);
		if (state.selectedId !== null) url.searchParams.set("run", state.selectedId);
		publish({ endpoint: url.toString() });
		try {
			const response = await fetch(url, {
				signal: controller.signal,
				headers: { accept: "application/json" },
				cache: "no-store"
			});
			const body = await response.json();
			if (body === null || typeof body !== "object") throw new Error(`unexpected response ${response.status}`);
			if (body.ok === false) {
				publish({
					loading: false,
					error: body.error?.message ?? `HTTP ${response.status}`
				});
				return;
			}
			publish({
				loading: false,
				error: null,
				available: body.available === true,
				reason: typeof body.reason === "string" ? body.reason : null,
				active: Array.isArray(body.active) ? body.active : [],
				recent: Array.isArray(body.recent) ? body.recent : [],
				detail: body.detail ?? null,
				selectedId: typeof body.selectedId === "string" ? body.selectedId : state.selectedId,
				dbPath: typeof body.dbPath === "string" ? body.dbPath : state.dbPath,
				updatedAt: Date.now()
			});
		} catch (error) {
			if (controller.signal.aborted) return;
			publish({
				loading: false,
				error: `无法连接插件 Host 半：${errorText(error)}`
			});
		} finally {
			if (inflight === controller) inflight = null;
		}
	};
	const tick = async () => {
		if (disposed || !polling) return;
		if (document.visibilityState === "hidden") {
			schedule();
			return;
		}
		await load();
		schedule();
	};
	const start = () => {
		if (polling) return;
		polling = true;
		tick();
	};
	const stop = () => {
		polling = false;
		clearTimer();
		inflight?.abort();
		inflight = null;
	};
	const onVisibility = () => {
		if (document.visibilityState === "visible" && polling) tick();
	};
	document.addEventListener("visibilitychange", onVisibility);
	return {
		subscribe(listener) {
			listeners.add(listener);
			if (listeners.size === 1) start();
			return () => {
				listeners.delete(listener);
				if (listeners.size === 0) stop();
			};
		},
		getSnapshot() {
			return state;
		},
		toggle() {
			publish({ open: !state.open });
			if (state.open) tick();
			else schedule();
		},
		setOpen(open) {
			if (state.open === open) return;
			publish({ open });
			if (open) tick();
			else schedule();
		},
		setSession(sessionId) {
			const next = sessionId === null || sessionId === "" ? null : sessionId;
			if (state.sessionId === next) return;
			publish({
				sessionId: next,
				active: [],
				recent: [],
				detail: null,
				selectedId: null,
				loading: true,
				error: null
			});
			load();
		},
		select(runId) {
			if (state.selectedId === runId) return;
			publish({
				selectedId: runId,
				loading: true
			});
			load();
		},
		refresh() {
			load();
		},
		dispose() {
			disposed = true;
			stop();
			document.removeEventListener("visibilitychange", onVisibility);
			listeners.clear();
		}
	};
}
function errorText(error) {
	if (error instanceof Error) return error.message;
	return String(error);
}
//#endregion
//#region
var inject = ["slots", "locale"];
var HEADER_SLOT = "conversation.session.header.utilities";
var OVERLAY_SLOT = "shell.overlay";
var MAIN_SLOT = "main";
var SIDEBAR_LIST_SLOT = "sidebar.panellist";
var INPUT_LEFT_SLOT = "conversation.input.left";
var CONVERSATION_VIEW_SLOT = "conversation.view";
var ENTRY_ID = "aiworkflow-progress";
var PANEL_ID = "aiworkflow";
function WorkflowIcon({ size = 18, active = false }) {
	return /* @__PURE__ */ react.createElement("svg", {
		width: size,
		height: size,
		viewBox: "0 0 24 24",
		"aria-hidden": "true",
		style: { display: "block" }
	}, /* @__PURE__ */ react.createElement("path", {
		d: "M5 7h5m4 0h5M7.5 9v6m9-6v6",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "1.6",
		strokeLinecap: "round",
		opacity: active ? 1 : .85
	}), /* @__PURE__ */ react.createElement("rect", {
		x: "3.2",
		y: "4.2",
		width: "4.6",
		height: "4.6",
		rx: "1.4",
		fill: "currentColor",
		opacity: active ? 1 : .7
	}), /* @__PURE__ */ react.createElement("rect", {
		x: "16.2",
		y: "4.2",
		width: "4.6",
		height: "4.6",
		rx: "1.4",
		fill: "currentColor",
		opacity: active ? 1 : .4
	}), /* @__PURE__ */ react.createElement("rect", {
		x: "9.7",
		y: "15.2",
		width: "4.6",
		height: "4.6",
		rx: "1.4",
		fill: "currentColor",
		opacity: "0.9"
	}));
}
function apply(ctx) {
	const disposeTexts = registerTexts(ctx);
	const t = bindTranslate(ctx);
	const store = createProgressStore();
	const layout = ctx.get("layout");
	const exitToConversation = () => layout?.selectPanel?.(null);
	ctx.effect(() => () => {
		store.dispose();
		disposeTexts();
	});
	let runTabDispose = null;
	const syncRunTab = () => {
		const snap = store.getSnapshot();
		const hasRuns = snap.sessionId !== null && (snap.active.length > 0 || snap.recent.length > 0);
		try {
			if (hasRuns && runTabDispose === null) runTabDispose = ctx.slots.inject(CONVERSATION_VIEW_SLOT, () => ctx.slots.register({
				name: CONVERSATION_VIEW_SLOT,
				id: "aiworkflow-runs",
				order: 20,
				label: () => t("panel.runs")
			}, (props) => /* @__PURE__ */ react.createElement(Boundary, { label: "运行图" }, /* @__PURE__ */ react.createElement(RunGraphPage, { sessionId: typeof props.sessionId === "string" ? props.sessionId : void 0 }))));
			else if (!hasRuns && runTabDispose !== null) {
				const dispose = runTabDispose;
				runTabDispose = null;
				dispose();
			}
		} catch (error) {
			reportError("运行图页签注册失败", error);
		}
	};
	ctx.effect(() => {
		const off = store.subscribe(syncRunTab);
		syncRunTab();
		return () => {
			off();
			if (runTabDispose !== null) {
				const dispose = runTabDispose;
				runTabDispose = null;
				dispose();
			}
		};
	});
	ctx.effect(() => ctx.slots.inject(HEADER_SLOT, () => ctx.slots.register({
		name: HEADER_SLOT,
		id: ENTRY_ID,
		order: 20
	}, (props) => /* @__PURE__ */ react.createElement(ProgressPill, {
		...props,
		sessionId: typeof props.sessionId === "string" ? props.sessionId : void 0,
		store,
		t
	}))));
	ctx.effect(() => ctx.slots.inject(OVERLAY_SLOT, () => ctx.slots.register({
		name: OVERLAY_SLOT,
		id: ENTRY_ID,
		order: 20
	}, (props) => /* @__PURE__ */ react.createElement(ProgressPanel, {
		...props,
		store,
		t
	}))));
	ctx.effect(() => ctx.slots.inject(SIDEBAR_LIST_SLOT, () => ctx.slots.register({
		name: SIDEBAR_LIST_SLOT,
		id: PANEL_ID,
		order: 40,
		label: () => t("panel.label")
	}, (props) => /* @__PURE__ */ react.createElement(WorkflowIcon, {
		size: props.size,
		active: props.active
	}))));
	ctx.effect(() => ctx.slots.inject(MAIN_SLOT, () => {
		try {
			return ctx.slots.register({
				name: MAIN_SLOT,
				key: PANEL_ID
			}, (props) => /* @__PURE__ */ react.createElement(Boundary, { label: "工作流页" }, /* @__PURE__ */ react.createElement(WorkflowPage, {
				...props,
				onExit: exitToConversation
			})));
		} catch (error) {
			reportError("主面板注册失败", error);
			return () => {};
		}
	}));
	ctx.effect(() => ctx.slots.inject(OVERLAY_SLOT, () => ctx.slots.register({
		name: OVERLAY_SLOT,
		id: "aiworkflow-runs",
		order: 30
	}, () => /* @__PURE__ */ react.createElement(RunGraphOverlay, { store }))));
	ctx.effect(() => ctx.slots.inject(INPUT_LEFT_SLOT, () => ctx.slots.register({
		name: INPUT_LEFT_SLOT,
		id: "aiworkflow-picker",
		order: 30
	}, (props) => /* @__PURE__ */ react.createElement(WorkflowPickerButton, props))));
	ctx.effect(() => ctx.slots.inject(OVERLAY_SLOT, () => ctx.slots.register({
		name: OVERLAY_SLOT,
		id: "aiworkflow-picker",
		order: 40
	}, () => /* @__PURE__ */ react.createElement(WorkflowPickerDialog, { onStarted: () => store.refresh() }))));
	ctx.effect(() => ctx.slots.inject(OVERLAY_SLOT, () => ctx.slots.register({
		name: OVERLAY_SLOT,
		id: "aiworkflow-diagnostics",
		order: 999
	}, () => /* @__PURE__ */ react.createElement(Diagnostics, null))));
}
//#endregion
exports.apply = apply;
exports.inject = inject;
    })(module, module.exports, require);
    return module.exports;
  },
});
