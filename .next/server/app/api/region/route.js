/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "app/api/region/route";
exports.ids = ["app/api/region/route"];
exports.modules = {

/***/ "next/dist/compiled/next-server/app-page.runtime.dev.js":
/*!*************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-page.runtime.dev.js" ***!
  \*************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/compiled/next-server/app-page.runtime.dev.js");

/***/ }),

/***/ "next/dist/compiled/next-server/app-route.runtime.dev.js":
/*!**************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-route.runtime.dev.js" ***!
  \**************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/compiled/next-server/app-route.runtime.dev.js");

/***/ }),

/***/ "../app-render/after-task-async-storage.external":
/*!***********************************************************************************!*\
  !*** external "next/dist/server/app-render/after-task-async-storage.external.js" ***!
  \***********************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/server/app-render/after-task-async-storage.external.js");

/***/ }),

/***/ "../app-render/work-async-storage.external":
/*!*****************************************************************************!*\
  !*** external "next/dist/server/app-render/work-async-storage.external.js" ***!
  \*****************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/server/app-render/work-async-storage.external.js");

/***/ }),

/***/ "./work-unit-async-storage.external":
/*!**********************************************************************************!*\
  !*** external "next/dist/server/app-render/work-unit-async-storage.external.js" ***!
  \**********************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/server/app-render/work-unit-async-storage.external.js");

/***/ }),

/***/ "(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fregion%2Froute&page=%2Fapi%2Fregion%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fregion%2Froute.ts&appDir=C%3A%5CUsers%5Cchash%5CDocuments%5CGitHub%5Canime_host_anix1%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5Cchash%5CDocuments%5CGitHub%5Canime_host_anix1&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!":
/*!****************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fregion%2Froute&page=%2Fapi%2Fregion%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fregion%2Froute.ts&appDir=C%3A%5CUsers%5Cchash%5CDocuments%5CGitHub%5Canime_host_anix1%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5Cchash%5CDocuments%5CGitHub%5Canime_host_anix1&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D! ***!
  \****************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   patchFetch: () => (/* binding */ patchFetch),\n/* harmony export */   routeModule: () => (/* binding */ routeModule),\n/* harmony export */   serverHooks: () => (/* binding */ serverHooks),\n/* harmony export */   workAsyncStorage: () => (/* binding */ workAsyncStorage),\n/* harmony export */   workUnitAsyncStorage: () => (/* binding */ workUnitAsyncStorage)\n/* harmony export */ });\n/* harmony import */ var next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/dist/server/route-modules/app-route/module.compiled */ \"(rsc)/./node_modules/next/dist/server/route-modules/app-route/module.compiled.js\");\n/* harmony import */ var next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var next_dist_server_route_kind__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next/dist/server/route-kind */ \"(rsc)/./node_modules/next/dist/server/route-kind.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! next/dist/server/lib/patch-fetch */ \"(rsc)/./node_modules/next/dist/server/lib/patch-fetch.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var C_Users_chash_Documents_GitHub_anime_host_anix1_app_api_region_route_ts__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./app/api/region/route.ts */ \"(rsc)/./app/api/region/route.ts\");\n\n\n\n\n// We inject the nextConfigOutput here so that we can use them in the route\n// module.\nconst nextConfigOutput = \"\"\nconst routeModule = new next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__.AppRouteRouteModule({\n    definition: {\n        kind: next_dist_server_route_kind__WEBPACK_IMPORTED_MODULE_1__.RouteKind.APP_ROUTE,\n        page: \"/api/region/route\",\n        pathname: \"/api/region\",\n        filename: \"route\",\n        bundlePath: \"app/api/region/route\"\n    },\n    resolvedPagePath: \"C:\\\\Users\\\\chash\\\\Documents\\\\GitHub\\\\anime_host_anix1\\\\app\\\\api\\\\region\\\\route.ts\",\n    nextConfigOutput,\n    userland: C_Users_chash_Documents_GitHub_anime_host_anix1_app_api_region_route_ts__WEBPACK_IMPORTED_MODULE_3__\n});\n// Pull out the exports that we need to expose from the module. This should\n// be eliminated when we've moved the other routes to the new format. These\n// are used to hook into the route.\nconst { workAsyncStorage, workUnitAsyncStorage, serverHooks } = routeModule;\nfunction patchFetch() {\n    return (0,next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__.patchFetch)({\n        workAsyncStorage,\n        workUnitAsyncStorage\n    });\n}\n\n\n//# sourceMappingURL=app-route.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvbmV4dC9kaXN0L2J1aWxkL3dlYnBhY2svbG9hZGVycy9uZXh0LWFwcC1sb2FkZXIvaW5kZXguanM/bmFtZT1hcHAlMkZhcGklMkZyZWdpb24lMkZyb3V0ZSZwYWdlPSUyRmFwaSUyRnJlZ2lvbiUyRnJvdXRlJmFwcFBhdGhzPSZwYWdlUGF0aD1wcml2YXRlLW5leHQtYXBwLWRpciUyRmFwaSUyRnJlZ2lvbiUyRnJvdXRlLnRzJmFwcERpcj1DJTNBJTVDVXNlcnMlNUNjaGFzaCU1Q0RvY3VtZW50cyU1Q0dpdEh1YiU1Q2FuaW1lX2hvc3RfYW5peDElNUNhcHAmcGFnZUV4dGVuc2lvbnM9dHN4JnBhZ2VFeHRlbnNpb25zPXRzJnBhZ2VFeHRlbnNpb25zPWpzeCZwYWdlRXh0ZW5zaW9ucz1qcyZyb290RGlyPUMlM0ElNUNVc2VycyU1Q2NoYXNoJTVDRG9jdW1lbnRzJTVDR2l0SHViJTVDYW5pbWVfaG9zdF9hbml4MSZpc0Rldj10cnVlJnRzY29uZmlnUGF0aD10c2NvbmZpZy5qc29uJmJhc2VQYXRoPSZhc3NldFByZWZpeD0mbmV4dENvbmZpZ091dHB1dD0mcHJlZmVycmVkUmVnaW9uPSZtaWRkbGV3YXJlQ29uZmlnPWUzMCUzRCEiLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7QUFBK0Y7QUFDdkM7QUFDcUI7QUFDaUM7QUFDOUc7QUFDQTtBQUNBO0FBQ0Esd0JBQXdCLHlHQUFtQjtBQUMzQztBQUNBLGNBQWMsa0VBQVM7QUFDdkI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTtBQUNBLFlBQVk7QUFDWixDQUFDO0FBQ0Q7QUFDQTtBQUNBO0FBQ0EsUUFBUSxzREFBc0Q7QUFDOUQ7QUFDQSxXQUFXLDRFQUFXO0FBQ3RCO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDMEY7O0FBRTFGIiwic291cmNlcyI6WyIiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQXBwUm91dGVSb3V0ZU1vZHVsZSB9IGZyb20gXCJuZXh0L2Rpc3Qvc2VydmVyL3JvdXRlLW1vZHVsZXMvYXBwLXJvdXRlL21vZHVsZS5jb21waWxlZFwiO1xuaW1wb3J0IHsgUm91dGVLaW5kIH0gZnJvbSBcIm5leHQvZGlzdC9zZXJ2ZXIvcm91dGUta2luZFwiO1xuaW1wb3J0IHsgcGF0Y2hGZXRjaCBhcyBfcGF0Y2hGZXRjaCB9IGZyb20gXCJuZXh0L2Rpc3Qvc2VydmVyL2xpYi9wYXRjaC1mZXRjaFwiO1xuaW1wb3J0ICogYXMgdXNlcmxhbmQgZnJvbSBcIkM6XFxcXFVzZXJzXFxcXGNoYXNoXFxcXERvY3VtZW50c1xcXFxHaXRIdWJcXFxcYW5pbWVfaG9zdF9hbml4MVxcXFxhcHBcXFxcYXBpXFxcXHJlZ2lvblxcXFxyb3V0ZS50c1wiO1xuLy8gV2UgaW5qZWN0IHRoZSBuZXh0Q29uZmlnT3V0cHV0IGhlcmUgc28gdGhhdCB3ZSBjYW4gdXNlIHRoZW0gaW4gdGhlIHJvdXRlXG4vLyBtb2R1bGUuXG5jb25zdCBuZXh0Q29uZmlnT3V0cHV0ID0gXCJcIlxuY29uc3Qgcm91dGVNb2R1bGUgPSBuZXcgQXBwUm91dGVSb3V0ZU1vZHVsZSh7XG4gICAgZGVmaW5pdGlvbjoge1xuICAgICAgICBraW5kOiBSb3V0ZUtpbmQuQVBQX1JPVVRFLFxuICAgICAgICBwYWdlOiBcIi9hcGkvcmVnaW9uL3JvdXRlXCIsXG4gICAgICAgIHBhdGhuYW1lOiBcIi9hcGkvcmVnaW9uXCIsXG4gICAgICAgIGZpbGVuYW1lOiBcInJvdXRlXCIsXG4gICAgICAgIGJ1bmRsZVBhdGg6IFwiYXBwL2FwaS9yZWdpb24vcm91dGVcIlxuICAgIH0sXG4gICAgcmVzb2x2ZWRQYWdlUGF0aDogXCJDOlxcXFxVc2Vyc1xcXFxjaGFzaFxcXFxEb2N1bWVudHNcXFxcR2l0SHViXFxcXGFuaW1lX2hvc3RfYW5peDFcXFxcYXBwXFxcXGFwaVxcXFxyZWdpb25cXFxccm91dGUudHNcIixcbiAgICBuZXh0Q29uZmlnT3V0cHV0LFxuICAgIHVzZXJsYW5kXG59KTtcbi8vIFB1bGwgb3V0IHRoZSBleHBvcnRzIHRoYXQgd2UgbmVlZCB0byBleHBvc2UgZnJvbSB0aGUgbW9kdWxlLiBUaGlzIHNob3VsZFxuLy8gYmUgZWxpbWluYXRlZCB3aGVuIHdlJ3ZlIG1vdmVkIHRoZSBvdGhlciByb3V0ZXMgdG8gdGhlIG5ldyBmb3JtYXQuIFRoZXNlXG4vLyBhcmUgdXNlZCB0byBob29rIGludG8gdGhlIHJvdXRlLlxuY29uc3QgeyB3b3JrQXN5bmNTdG9yYWdlLCB3b3JrVW5pdEFzeW5jU3RvcmFnZSwgc2VydmVySG9va3MgfSA9IHJvdXRlTW9kdWxlO1xuZnVuY3Rpb24gcGF0Y2hGZXRjaCgpIHtcbiAgICByZXR1cm4gX3BhdGNoRmV0Y2goe1xuICAgICAgICB3b3JrQXN5bmNTdG9yYWdlLFxuICAgICAgICB3b3JrVW5pdEFzeW5jU3RvcmFnZVxuICAgIH0pO1xufVxuZXhwb3J0IHsgcm91dGVNb2R1bGUsIHdvcmtBc3luY1N0b3JhZ2UsIHdvcmtVbml0QXN5bmNTdG9yYWdlLCBzZXJ2ZXJIb29rcywgcGF0Y2hGZXRjaCwgIH07XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWFwcC1yb3V0ZS5qcy5tYXAiXSwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fregion%2Froute&page=%2Fapi%2Fregion%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fregion%2Froute.ts&appDir=C%3A%5CUsers%5Cchash%5CDocuments%5CGitHub%5Canime_host_anix1%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5Cchash%5CDocuments%5CGitHub%5Canime_host_anix1&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!\n");

/***/ }),

/***/ "(rsc)/./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true!":
/*!******************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true! ***!
  \******************************************************************************************************/
/***/ (() => {



/***/ }),

/***/ "(ssr)/./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true!":
/*!******************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true! ***!
  \******************************************************************************************************/
/***/ (() => {



/***/ }),

/***/ "(rsc)/./app/api/region/route.ts":
/*!*********************************!*\
  !*** ./app/api/region/route.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   GET: () => (/* binding */ GET)\n/* harmony export */ });\n/* harmony import */ var next_server__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/server */ \"(rsc)/./node_modules/next/dist/api/server.js\");\n\nconst normalize = (input)=>{\n    const obj = input ?? {};\n    const countryName = typeof obj.country_name === 'string' && obj.country_name || typeof obj.country === 'string' && obj.country || null;\n    const countryCode = typeof obj.country_code === 'string' && obj.country_code || typeof obj.countryCode === 'string' && obj.countryCode || typeof obj.country_code2 === 'string' && obj.country_code2 || null;\n    return {\n        country_name: countryName,\n        country_code: countryCode,\n        source: null\n    };\n};\nconst fetchJson = async (url, timeoutMs)=>{\n    const controller = new AbortController();\n    const t = setTimeout(()=>controller.abort(), timeoutMs);\n    try {\n        const res = await fetch(url, {\n            signal: controller.signal,\n            cache: 'no-store',\n            headers: {\n                accept: 'application/json'\n            }\n        });\n        if (!res.ok) return null;\n        return await res.json();\n    } catch  {\n        return null;\n    } finally{\n        clearTimeout(t);\n    }\n};\nasync function GET() {\n    try {\n        const sources = [\n            {\n                name: 'ipapi.co',\n                url: 'https://ipapi.co/json/'\n            },\n            {\n                name: 'ip-api.com',\n                url: 'http://ip-api.com/json/'\n            }\n        ];\n        for (const s of sources){\n            const raw = await fetchJson(s.url, 5000);\n            if (!raw) continue;\n            const normalized = normalize(raw);\n            if (normalized.country_name || normalized.country_code) {\n                normalized.source = s.name;\n                return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json(normalized, {\n                    status: 200\n                });\n            }\n        }\n        return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            country_name: null,\n            country_code: null,\n            source: null\n        }, {\n            status: 200\n        });\n    } catch (error) {\n        console.error('Region API error:', error);\n        return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            country_name: null,\n            country_code: null,\n            source: null\n        }, {\n            status: 200\n        });\n    }\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9hcHAvYXBpL3JlZ2lvbi9yb3V0ZS50cyIsIm1hcHBpbmdzIjoiOzs7OztBQUEwQztBQVExQyxNQUFNQyxZQUFZLENBQUNDO0lBQ2pCLE1BQU1DLE1BQU9ELFNBQVMsQ0FBQztJQUV2QixNQUFNRSxjQUNKLE9BQVFELElBQUlFLFlBQVksS0FBSyxZQUFZRixJQUFJRSxZQUFZLElBQ3hELE9BQU9GLElBQUlHLE9BQU8sS0FBSyxZQUFZSCxJQUFJRyxPQUFPLElBQy9DO0lBRUYsTUFBTUMsY0FDSixPQUFRSixJQUFJSyxZQUFZLEtBQUssWUFBWUwsSUFBSUssWUFBWSxJQUN4RCxPQUFPTCxJQUFJSSxXQUFXLEtBQUssWUFBWUosSUFBSUksV0FBVyxJQUN0RCxPQUFPSixJQUFJTSxhQUFhLEtBQUssWUFBWU4sSUFBSU0sYUFBYSxJQUMzRDtJQUVGLE9BQU87UUFDTEosY0FBY0Q7UUFDZEksY0FBY0Q7UUFDZEcsUUFBUTtJQUNWO0FBQ0Y7QUFFQSxNQUFNQyxZQUFZLE9BQU9DLEtBQWFDO0lBQ3BDLE1BQU1DLGFBQWEsSUFBSUM7SUFDdkIsTUFBTUMsSUFBSUMsV0FBVyxJQUFNSCxXQUFXSSxLQUFLLElBQUlMO0lBRS9DLElBQUk7UUFDRixNQUFNTSxNQUFNLE1BQU1DLE1BQU1SLEtBQUs7WUFDM0JTLFFBQVFQLFdBQVdPLE1BQU07WUFDekJDLE9BQU87WUFDUEMsU0FBUztnQkFDUEMsUUFBUTtZQUNWO1FBQ0Y7UUFFQSxJQUFJLENBQUNMLElBQUlNLEVBQUUsRUFBRSxPQUFPO1FBQ3BCLE9BQU8sTUFBTU4sSUFBSU8sSUFBSTtJQUN2QixFQUFFLE9BQU07UUFDTixPQUFPO0lBQ1QsU0FBVTtRQUNSQyxhQUFhWDtJQUNmO0FBQ0Y7QUFFTyxlQUFlWTtJQUNwQixJQUFJO1FBQ0YsTUFBTUMsVUFBZ0Q7WUFDcEQ7Z0JBQUVDLE1BQU07Z0JBQVlsQixLQUFLO1lBQXlCO1lBQ2xEO2dCQUFFa0IsTUFBTTtnQkFBY2xCLEtBQUs7WUFBMEI7U0FDdEQ7UUFFRCxLQUFLLE1BQU1tQixLQUFLRixRQUFTO1lBQ3ZCLE1BQU1HLE1BQU0sTUFBTXJCLFVBQVVvQixFQUFFbkIsR0FBRyxFQUFFO1lBQ25DLElBQUksQ0FBQ29CLEtBQUs7WUFFVixNQUFNQyxhQUFhaEMsVUFBVStCO1lBQzdCLElBQUlDLFdBQVc1QixZQUFZLElBQUk0QixXQUFXekIsWUFBWSxFQUFFO2dCQUN0RHlCLFdBQVd2QixNQUFNLEdBQUdxQixFQUFFRCxJQUFJO2dCQUMxQixPQUFPOUIscURBQVlBLENBQUMwQixJQUFJLENBQUNPLFlBQVk7b0JBQUVDLFFBQVE7Z0JBQUk7WUFDckQ7UUFDRjtRQUVBLE9BQU9sQyxxREFBWUEsQ0FBQzBCLElBQUksQ0FDdEI7WUFBRXJCLGNBQWM7WUFBTUcsY0FBYztZQUFNRSxRQUFRO1FBQUssR0FDdkQ7WUFBRXdCLFFBQVE7UUFBSTtJQUVsQixFQUFFLE9BQU9DLE9BQU87UUFDZEMsUUFBUUQsS0FBSyxDQUFDLHFCQUFxQkE7UUFDbkMsT0FBT25DLHFEQUFZQSxDQUFDMEIsSUFBSSxDQUN0QjtZQUFFckIsY0FBYztZQUFNRyxjQUFjO1lBQU1FLFFBQVE7UUFBSyxHQUN2RDtZQUFFd0IsUUFBUTtRQUFJO0lBRWxCO0FBQ0YiLCJzb3VyY2VzIjpbIkM6XFxVc2Vyc1xcY2hhc2hcXERvY3VtZW50c1xcR2l0SHViXFxhbmltZV9ob3N0X2FuaXgxXFxhcHBcXGFwaVxccmVnaW9uXFxyb3V0ZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBOZXh0UmVzcG9uc2UgfSBmcm9tICduZXh0L3NlcnZlcidcclxuXHJcbnR5cGUgUmVnaW9uUGF5bG9hZCA9IHtcclxuICBjb3VudHJ5X25hbWU6IHN0cmluZyB8IG51bGxcclxuICBjb3VudHJ5X2NvZGU6IHN0cmluZyB8IG51bGxcclxuICBzb3VyY2U6IHN0cmluZyB8IG51bGxcclxufVxyXG5cclxuY29uc3Qgbm9ybWFsaXplID0gKGlucHV0OiB1bmtub3duKTogUmVnaW9uUGF5bG9hZCA9PiB7XHJcbiAgY29uc3Qgb2JqID0gKGlucHV0ID8/IHt9KSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPlxyXG5cclxuICBjb25zdCBjb3VudHJ5TmFtZSA9XHJcbiAgICAodHlwZW9mIG9iai5jb3VudHJ5X25hbWUgPT09ICdzdHJpbmcnICYmIG9iai5jb3VudHJ5X25hbWUpIHx8XHJcbiAgICAodHlwZW9mIG9iai5jb3VudHJ5ID09PSAnc3RyaW5nJyAmJiBvYmouY291bnRyeSkgfHxcclxuICAgIG51bGxcclxuXHJcbiAgY29uc3QgY291bnRyeUNvZGUgPVxyXG4gICAgKHR5cGVvZiBvYmouY291bnRyeV9jb2RlID09PSAnc3RyaW5nJyAmJiBvYmouY291bnRyeV9jb2RlKSB8fFxyXG4gICAgKHR5cGVvZiBvYmouY291bnRyeUNvZGUgPT09ICdzdHJpbmcnICYmIG9iai5jb3VudHJ5Q29kZSkgfHxcclxuICAgICh0eXBlb2Ygb2JqLmNvdW50cnlfY29kZTIgPT09ICdzdHJpbmcnICYmIG9iai5jb3VudHJ5X2NvZGUyKSB8fFxyXG4gICAgbnVsbFxyXG5cclxuICByZXR1cm4ge1xyXG4gICAgY291bnRyeV9uYW1lOiBjb3VudHJ5TmFtZSxcclxuICAgIGNvdW50cnlfY29kZTogY291bnRyeUNvZGUsXHJcbiAgICBzb3VyY2U6IG51bGwsXHJcbiAgfVxyXG59XHJcblxyXG5jb25zdCBmZXRjaEpzb24gPSBhc3luYyAodXJsOiBzdHJpbmcsIHRpbWVvdXRNczogbnVtYmVyKSA9PiB7XHJcbiAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKVxyXG4gIGNvbnN0IHQgPSBzZXRUaW1lb3V0KCgpID0+IGNvbnRyb2xsZXIuYWJvcnQoKSwgdGltZW91dE1zKVxyXG5cclxuICB0cnkge1xyXG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2godXJsLCB7XHJcbiAgICAgIHNpZ25hbDogY29udHJvbGxlci5zaWduYWwsXHJcbiAgICAgIGNhY2hlOiAnbm8tc3RvcmUnLFxyXG4gICAgICBoZWFkZXJzOiB7XHJcbiAgICAgICAgYWNjZXB0OiAnYXBwbGljYXRpb24vanNvbicsXHJcbiAgICAgIH0sXHJcbiAgICB9KVxyXG5cclxuICAgIGlmICghcmVzLm9rKSByZXR1cm4gbnVsbFxyXG4gICAgcmV0dXJuIGF3YWl0IHJlcy5qc29uKClcclxuICB9IGNhdGNoIHtcclxuICAgIHJldHVybiBudWxsXHJcbiAgfSBmaW5hbGx5IHtcclxuICAgIGNsZWFyVGltZW91dCh0KVxyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIEdFVCgpIHtcclxuICB0cnkge1xyXG4gICAgY29uc3Qgc291cmNlczogQXJyYXk8eyBuYW1lOiBzdHJpbmc7IHVybDogc3RyaW5nIH0+ID0gW1xyXG4gICAgICB7IG5hbWU6ICdpcGFwaS5jbycsIHVybDogJ2h0dHBzOi8vaXBhcGkuY28vanNvbi8nIH0sXHJcbiAgICAgIHsgbmFtZTogJ2lwLWFwaS5jb20nLCB1cmw6ICdodHRwOi8vaXAtYXBpLmNvbS9qc29uLycgfSxcclxuICAgIF1cclxuXHJcbiAgICBmb3IgKGNvbnN0IHMgb2Ygc291cmNlcykge1xyXG4gICAgICBjb25zdCByYXcgPSBhd2FpdCBmZXRjaEpzb24ocy51cmwsIDUwMDApXHJcbiAgICAgIGlmICghcmF3KSBjb250aW51ZVxyXG5cclxuICAgICAgY29uc3Qgbm9ybWFsaXplZCA9IG5vcm1hbGl6ZShyYXcpXHJcbiAgICAgIGlmIChub3JtYWxpemVkLmNvdW50cnlfbmFtZSB8fCBub3JtYWxpemVkLmNvdW50cnlfY29kZSkge1xyXG4gICAgICAgIG5vcm1hbGl6ZWQuc291cmNlID0gcy5uYW1lXHJcbiAgICAgICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKG5vcm1hbGl6ZWQsIHsgc3RhdHVzOiAyMDAgfSlcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbihcclxuICAgICAgeyBjb3VudHJ5X25hbWU6IG51bGwsIGNvdW50cnlfY29kZTogbnVsbCwgc291cmNlOiBudWxsIH0sXHJcbiAgICAgIHsgc3RhdHVzOiAyMDAgfSxcclxuICAgIClcclxuICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgY29uc29sZS5lcnJvcignUmVnaW9uIEFQSSBlcnJvcjonLCBlcnJvcilcclxuICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbihcclxuICAgICAgeyBjb3VudHJ5X25hbWU6IG51bGwsIGNvdW50cnlfY29kZTogbnVsbCwgc291cmNlOiBudWxsIH0sXHJcbiAgICAgIHsgc3RhdHVzOiAyMDAgfSxcclxuICAgIClcclxuICB9XHJcbn1cclxuIl0sIm5hbWVzIjpbIk5leHRSZXNwb25zZSIsIm5vcm1hbGl6ZSIsImlucHV0Iiwib2JqIiwiY291bnRyeU5hbWUiLCJjb3VudHJ5X25hbWUiLCJjb3VudHJ5IiwiY291bnRyeUNvZGUiLCJjb3VudHJ5X2NvZGUiLCJjb3VudHJ5X2NvZGUyIiwic291cmNlIiwiZmV0Y2hKc29uIiwidXJsIiwidGltZW91dE1zIiwiY29udHJvbGxlciIsIkFib3J0Q29udHJvbGxlciIsInQiLCJzZXRUaW1lb3V0IiwiYWJvcnQiLCJyZXMiLCJmZXRjaCIsInNpZ25hbCIsImNhY2hlIiwiaGVhZGVycyIsImFjY2VwdCIsIm9rIiwianNvbiIsImNsZWFyVGltZW91dCIsIkdFVCIsInNvdXJjZXMiLCJuYW1lIiwicyIsInJhdyIsIm5vcm1hbGl6ZWQiLCJzdGF0dXMiLCJlcnJvciIsImNvbnNvbGUiXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(rsc)/./app/api/region/route.ts\n");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/next"], () => (__webpack_exec__("(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fregion%2Froute&page=%2Fapi%2Fregion%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fregion%2Froute.ts&appDir=C%3A%5CUsers%5Cchash%5CDocuments%5CGitHub%5Canime_host_anix1%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5Cchash%5CDocuments%5CGitHub%5Canime_host_anix1&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!")));
module.exports = __webpack_exports__;

})();