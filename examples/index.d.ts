import { ICommandArguments, ICommandLineApp } from '../';
export declare class Example {
    defaultCommand(args: ICommandArguments): void;
    testCommand(args: ICommandArguments, app: ICommandLineApp): void;
    mainCommand(args: ICommandArguments): void;
    secondaryCommand(args: ICommandArguments): void;
    commandWithOptions(args: ICommandArguments): void;
    commandWithFlag(args: ICommandArguments): void;
    richContentCommand(args: ICommandArguments, app: ICommandLineApp): void;
}
