import { CommandHandler, Command, Types } from "..";

@CommandHandler()
export class NextCommandTest {

    @Command([
        { name: "args", type: Types.Args }
    ])
    public run() {
        //
    }

}
