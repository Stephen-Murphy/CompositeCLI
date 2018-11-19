"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const __1 = require("../");
const kind_of_1 = __importDefault(require("kind-of"));
let Example = class Example {
    defaultCommand(args) {
        console.log('running defaultCommand');
        console.assert(args.options.size === 0);
    }
    testCommand(args, app) {
        console.log('running testCommand');
        args;
        app.runCommand([]);
        app.runCommand(['main']);
        app.runCommand(['secondary']);
        app.runCommand(['options', '--one']);
        app.runCommand(['flags', '-o']);
        debugger;
        app.runCommand(['rich', '--ref', 'test']);
    }
    mainCommand(args) {
        console.log('running mainCommand');
        console.assert(args.command.command === 'main' && args.options.size === 0);
    }
    secondaryCommand(args) {
        console.log('running secondaryCommand');
        console.assert(args.command.command === 'secondary' &&
            args.command.alias === 's' &&
            args.options.size === 0);
    }
    commandWithOptions(args) {
        console.log('running commandWithOptions');
        console.assert(args.options.size === 2 || args.options.size === 0); // includes alias
    }
    commandWithFlag(args) {
        console.log('running commandWithFlag');
        console.assert(args.flags.has('o'), 'didnt have -o');
    }
    richContentCommand(args, app) {
        console.log('running richContentCommand');
        const value = args.options.get('ref');
        if (kind_of_1.default(value) === 'string') {
            if (value === 'test') {
                console.log('got test');
                debugger;
                app.runCommand(['rich', '--ref', this.richContentCommand]);
            }
            else {
                throw new Error();
            }
        }
        else if (kind_of_1.default(value) === 'function') {
            console.log('got function');
            if (value !== this.richContentCommand)
                throw new Error();
            app.runCommand(['rich', '--ref', [1, 2, 3]]);
        }
        else if (kind_of_1.default(value) === 'array') {
            console.log('got array');
            app.runCommand(['rich', '--ref', { test: 123 }]);
        }
        else if (kind_of_1.default(value) === 'object') {
            console.log('got object');
        }
    }
};
__decorate([
    __1.Command(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], Example.prototype, "defaultCommand", null);
__decorate([
    __1.Command('test'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], Example.prototype, "testCommand", null);
__decorate([
    __1.Command('main'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], Example.prototype, "mainCommand", null);
__decorate([
    __1.Command('secondary', 's'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], Example.prototype, "secondaryCommand", null);
__decorate([
    __1.Command('options', 'o', [
        { name: 'one', alias: 'o', type: __1.Command.Type.Boolean }
    ]),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], Example.prototype, "commandWithOptions", null);
__decorate([
    __1.Command('flags', 'f', [
        { name: 'one', flag: 'o' }
    ]),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], Example.prototype, "commandWithFlag", null);
__decorate([
    __1.Command('rich', [
        { name: 'ref', alias: 'r', type: __1.Command.Type.Function | __1.Command.Type.Array | __1.Command.Type.Object | __1.Command.Type.String }
    ]),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], Example.prototype, "richContentCommand", null);
Example = __decorate([
    __1.CommandHandler()
], Example);
exports.Example = Example;
const app = new __1.CommandLineApp();
app.runCommand();
//# sourceMappingURL=index.js.map