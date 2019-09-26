import CommandLineApp from '../../src/core/CommandLineApp';
// import { Example } from '../../src/examples/index';

const app = new CommandLineApp();

describe("E2E", () => {

    it("should run example commands", async () => {

        expect.assertions(12);

        expect(await app.runCommand([])).toBe('default');
        expect(await app.runCommand(['main'])).toBe('main');
        expect(await app.runCommand(['secondary'])).toBe('secondary');
        expect(await app.runCommand(['s'])).toBe('secondary');
        expect(await app.runCommand(['options'])).toBe(false);
        expect(await app.runCommand(['options', '--o'])).toBe(true);
        expect(await app.runCommand(['flags'])).toBe(false);
        expect(await app.runCommand(['flags', '-o'])).toBe(true);
        const arr: any[] = [];
        const obj: any = { test: 123 };
        // const fn: any = Example.prototype.complexContentCommand;
        const str: any = 'test';
        // complex commands passes through and runs each type until object is found
        expect(await app.runCommand(['complex', '--ref', arr])).toEqual(obj);
        expect(await app.runCommand(['complex', '--ref', obj])).toEqual(obj);
        // expect(await app.runCommand(['complex', '--ref', fn])).toEqual(obj);
        expect(await app.runCommand(['complex', '--ref', str])).toEqual(obj);

    });



});
