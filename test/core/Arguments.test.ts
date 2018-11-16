import { Arguments } from '../../src/core/Arguments';
import { RegisteredCommand, ICommandArguments } from '../../src/core/types';

describe('Arguments class', () => {

    it('should assign input on construction', () => {

        const command: RegisteredCommand = {
            command: '',
            alias: '',
            descriptor: {
                configurable: false
            },
            method: '',
            options: [],
            target: {}
        };
        const argv: ReadonlyArray<string> = [];
        const flags = new Map<string, boolean>();
        const options = new Map<string | number, string | number | boolean | null>();
        const positionals: Array<string | number | boolean | null> = [];

        let a: ICommandArguments;
        expect(() => a = new Arguments(command, argv, flags, options, positionals)).not.toThrow();
        expect(a!.command).toBe(command);
        expect(a!.argv).not.toBe(argv);
        expect(a!.argv).toEqual(argv);
        expect(a!.flags).toBe(flags);
        expect(a!.options).toBe(options);
        expect(a!.positionals).toBe(positionals);

    });

});
