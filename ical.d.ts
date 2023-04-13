declare module "ical.js" {
    export function parse(input: string): Object | Object[]

    export class Component {
        readonly name: string
        constructor(jCal: Object[] | String, parent?: Component) // according to jsdoc, parent isn't optional but it is?
        getAllProperties(name?: string): Property[]
        getAllSubcomponents(name?: string): Component[]
    }

    export class Property {
        readonly name: string
        readonly type: string
        parent: Component
        getFirstValue(): string
        getParameter(name: string): string // and array, apparently
    }
}
