
export const Default: unique symbol = Symbol("[DefaultCommand]");
export const Fallback: unique symbol = Symbol("[FallbackHandler]");

export type RegisteredCommandHandler = {
    readonly handlerClass: Function; // class constructor
    readonly command: string | typeof Default;
    readonly alias: string | null; // null if command is Default
    readonly methods: Array<RegisteredCommand>;
};

export type RegisteredCommand = {
    readonly target: object; // host class of method
    readonly method: string; // target[method]
    readonly command: string | typeof Default | typeof Fallback;
    readonly alias: string | null; // null if command is Default
    readonly options: RegisteredCommandOption[];
    readonly descriptor: PropertyDescriptor;
};

export interface ICommandLineApp {
    logLine(message: string): void;
    runCommand<T extends any>(args: any[]): Promise<T>;
}

export interface ICommandRegistry {
    readonly handlers: Array<RegisteredCommandHandler>;
    readonly commands: Array<RegisteredCommand>;
    readonly reconciledCommands: Map<string | typeof Fallback, RegisteredCommand>;
    registerHandler(name: string | typeof Default, alias: string | null, handlerClass: Function): void;
    registerCommand(command: string | typeof Default | typeof Fallback, alias: string | null, options: RegisteredCommandOption[], target: object, method: string, descriptor: PropertyDescriptor): void;
    getCommand(command: string | typeof Fallback): RegisteredCommand | null;
    reset(hard: boolean): void;
}

// param-case - with numbers - first char can't be number
// valid: a, a-a, a-1, a1-1, a1-111, a-a1 etc
export const CommandNameRegex = /^[a-z]+[a-z0-9]*(-[a-z0-9]+)*$/;

export const Type = Object.freeze({
    Boolean: <1>1,
    Number: <2>2,
    String: <4>4,
    Integer: <8>8,
    Array: <16>16,
    Object: <32>32,
    Function: <64>64, // when used internally
    Map: <128>128, // when used internally
    Set: <256>256, // when used internally
    Buffer: <512>512, // when used internally
    Args: <1024>1024,
    Null: <2048>2048
});

export interface ICommandMetadata {
    name: string;
    alias: string | null;
    options: TCommandOption[];
}

export type TCommandOption = string | { // string as --named-flag
    name?: string; // e.g. --save-dev (pascal-case) must exist if alias does, can exist if flag or positional specified
    alias?: string; // e.g. [ name = --dir, alias = -d ]
    flag?: string; // e.g. -D (only if type is boolean) (case-sensitive - single character a-z A-Z)
    positional?: true; // only if flag not specified - type can't be boolean
    type?: number; // must be specified unless flag is passed (will default to boolean)
};

export type RegisteredCommandOption = {
    name: string | null;
    alias: string | null;
    flag: string | null;
    positional: boolean;
    type: number;
};

export type DecoratorResult = (target: object, propertyKey: string, descriptor: PropertyDescriptor) => void;

export type TCommandDecorator = {
    (): DecoratorResult;
    (name: string | typeof Fallback): DecoratorResult;
    (name: string | typeof Fallback, alias: string): DecoratorResult;
    (options: TCommandOption[]): DecoratorResult;
    (name: string | typeof Fallback, options: TCommandOption[]): DecoratorResult;
    (name: string | typeof Fallback, alias: string, options: TCommandOption[]): DecoratorResult;
    Type: typeof Type;
};

export interface ICommandArguments {
    readonly command: RegisteredCommand;
    readonly argv: ReadonlyArray<string>;
    readonly flags: Set<string>;
    readonly options: Map<string | number, any>;
    readonly positionals: Array<any>;
}
