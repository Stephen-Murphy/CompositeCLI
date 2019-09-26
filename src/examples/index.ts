import { CommandHandler, Command, ICommandArguments, ICommandLineApp } from '../';
// import kindOf from 'kind-of';


@CommandHandler()
export class Example {

    @Command()
    public defaultCommand(args: ICommandArguments) {
        args;
        return 'default';
    }

    @Command('test')
    public testCommand(args: ICommandArguments, app: ICommandLineApp) {
        app.runCommand([]);
        app.runCommand(['main']);
        app.runCommand(['secondary']);
        app.runCommand(['options', '--one']);
        app.runCommand(['flags', '-o']);
        app.runCommand(['complex', '--ref', 'test']);
        return args.command.command;
    }

    @Command('main')
    public mainCommand(args: ICommandArguments) {
        return args.command.command;
    }

    @Command('secondary', 's')
    public secondaryCommand(args: ICommandArguments) {
        return args.command.command;
    }

    @Command('options', 'o', [
        { name: 'one', alias: 'o', type: Command.Type.Boolean }
    ])
    public commandWithOptions(args: ICommandArguments) {
        return args.options.has('o');
    }

    @Command('flags', 'f', [
        { name: 'one', flag: 'o' }
    ])
    public commandWithFlag(args: ICommandArguments) {
        return args.flags.has('o');
    }

    /* @Command('complex', [
        { name: 'ref', alias: 'r', type: Command.Type.Function | Command.Type.Array | Command.Type.Object | Command.Type.String }
    ])
    public complexContentCommand(args: ICommandArguments, app: ICommandLineApp) {
        const value = args.options.get('ref');
        if (kindOf(value) === 'string') {
            if (value === 'test') {
                return app.runCommand(['complex', '--ref', this.complexContentCommand]);
            } else {
                throw new Error();
            }
        } else if (kindOf(value) === 'function') {
            if ((<any>value) !== this.complexContentCommand) throw new Error();
            return app.runCommand(['complex', '--ref', [1, 2, 3]]);
        } else if (kindOf(value) === 'array') {
            return app.runCommand(['complex', '--ref', { test: 123 }]);
        } else if (kindOf(value) === 'object') {
            return value;
        }
        return value;
    } */

}
