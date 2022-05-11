/* 
 * This file is part of Flower.
 * 
 * Copyright ©2018 Nicolò Mazzucato
 * Copyright ©2018 Antonio Groza
 * Copyright ©2018 Brunello Simone
 * Copyright ©2018 Alessio Marotta
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 * 
 * Flower is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * Flower is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with Flower.  If not, see <https://www.gnu.org/licenses/>.
 */

// @flow

import React, { Component } from "react";
import { fetchFlow, getPythonRequest, getPwnRequest } from "../data/fetcher";
import SimpleModalWrapped from "./CopyModal";
import FlowItem_type from "./FlowItem";

//ui
import FlowItem from "./FlowItem";
import Paper from "@material-ui/core/Paper";
import { withStyles } from "@material-ui/core/styles";

//utility
import DOMPurify from "dompurify";
import hexdump from "hexdump-nodejs";
import { Buffer } from "buffer/";
import _ from "lodash/core";

const styles = theme => ({
    root: theme.mixins.gutters({
        paddingTop: 16,
        paddingBottom: 16,
        marginTop: theme.spacing.unit * 3
    }),
    paper: {
        position: "fixed",
        backroundColor: "#000000",
        bottom: 0,
        top: 70,
        right: 0,
        overflow: "auto",
        margin: 20,
        width: "50%"
    }
});

type state_types = {
    flow_id: string,
    flow_data: Array<FlowItem_type>,
    to_copy: string,
    modal_opened: boolean
};
type props_types = {
    classes: *,
    flow: FlowItem_type,
    hexdump: boolean,
    filter: *
};
export class FlowDetail extends Component<props_types, state_types> {
    constructor(props: props_types) {
        super(props);
        this.state = {
            flow_id: "",
            flow_data: [],
            to_copy: "",
            modal_opened: false
        };
    }

    componentDidMount() {
        this.loadFlow();
    }
    componentDidUpdate() {
        this.loadFlow();
    }
    loadFlow() {
        const flow_id = this.props.flow._id["$oid"];

        if (this.state.flow_id === flow_id) {
            return;
        }
        fetchFlow(flow_id, flow => {
            this.setState({ flow_id: flow_id, flow_data: flow.flow });
        });
    }
    onClose() {
        this.setState({ modal_opened: false });
    }
    render() {
        const { classes } = this.props;

        const this_flow = this.props.flow;
        const this_flow_data = this.state.flow_data;
        return (
            <Paper className={classes.paper}>
                {/* modal for copy*/}
                <SimpleModalWrapped
                    text_to_copy={this.state.to_copy}
                    onClose={() => this.onClose()}
                    isOpen={this.state.modal_opened}
                />
                <FlowItem item={this_flow} large={true} hideFavourite={true} />
                <div
                    onClick={() =>
                        this.fetchPwnTextToCopy(this_flow["_id"]["$oid"])
                    }
                >
                    Copy Pwn
                </div>

                <div>
                    {this_flow_data.map((item, inx) =>
                        this.renderItem(item, inx)
                    )}
                </div>
            </Paper>
        );
    }

    renderItem(item: FlowItem_type, inx: number) {
        const start_time = this.props.flow.time;

        return (
            <div
                onDoubleClick={() => {
                    this.fetchTextToCopy(item);
                }}
            >
                <Paper
                    style={{
                        padding: 10,
                        margin: 10,
                        marginLeft: item.from === "c" ? 200 : 10,
                        marginRight: item.from === "c" ? 10 : 200
                    }}
                >
                    <div
                        style={{
                            fontFamily: "courier"
                        }}
                    >
                        {" "}
                        {"" + inx + ". "}
                        {item.from === "c" ? "Server" : "Client"}{" "}
                        {" +" + (item.time - start_time) + " ms"}
                        <pre
                            style={{
                                margin: 20,
                                right: 0,
                                overflow: "auto",
                                whiteSpace: "pre-line",
                                wordWrap: "break-word"
                            }}
                            dangerouslySetInnerHTML={{
                                __html: this.get_text_formatted(item)
                            }}
                        />
                    </div>
                </Paper>
            </div>
        );
    }
    fetchTextToCopy(item: FlowItem_type) {
        getPythonRequest(item.data, to_copy => {
            this.openModalWithText(to_copy);
        });
    }
    fetchPwnTextToCopy(item: FlowItem_type) {
        getPwnRequest(item, to_copy => {
            this.openModalWithText(to_copy);
        });
    }
    openModalWithText(text: string) {
        this.setState({ modal_opened: true, to_copy:text });
    }

    get_text_formatted(item: FlowItem_type) {
        return this.props.hexdump
            ? this.get_hexdump(item.hex)
            : this.hilight_flag(item.data);
    }
    //convert hex string to ascii string
    fromHex(h: string) {
        var s = "";
        for (var i = 0; i < h.length; i += 2) {
            s += String.fromCharCode(parseInt(h.substr(i, 2), 16));
        }
        return s;
    }
    get_hexdump(text: string) {
        var toDump = this.fromHex(text);
        var buffer = Buffer.from(toDump);
        return this.color_hexdump(
            hexdump(buffer).replace("Offset ", "Offset _") //fix this
        );
    }
    color_hexdump(text: string) {
        var lines = text.split("\n");
        var result = lines[0] + "\n";
        for (var line of lines.slice(1)) result += this.color_hexdump_line(line);
        return result;
    }
    color_hexdump_line(line: string) {
        if (line.length === 0) return "";
        var colors = ["#993300", "#000099", "#993300", "#000099"]; //inizialmente sopportava 4 colori
        var offset = line.substring(0, 10);
        var bytes = line.substring(10, 10 + 48);
        var bytes_result = "";

        bytes = bytes.replaceAll("   ", " __"); // FIXME
        for (var i = 0; i < 48; i += 12)
            bytes_result +=
                '<b><span style="color:' +
                colors[i / 12] +
                '">' +
                bytes.substring(i, i + 12) +
                "</span></b>";

        var rem = line.substring(10 + 49);
        rem.padEnd(16, " ");
        var text_result = "";
        for (i = 0; i < 16; i += 4)
            text_result +=
                '<b><span style="color:' +
                colors[i / 4] +
                '">' +
                _.escape(rem.substring(i, i + 4)).replaceAll(/[^\x21-\x7f]/ig, ".") + // FIXME;
                "</span></b>";

        return offset + bytes_result + "|" + text_result + "|\n";
    }

    getFlagRegex() : string {
        return process.env.REACT_APP_FLAG_REGEX || "[A-Z0-9]{31}=";
    }
    hilight_flag(text: string) {
        var reg = null;
        if (this.props.filter) {
            try {
                // The filter might not be a valid regex
                reg = new RegExp(this.props.filter, "i"); //this.props.regex);
            } catch(e) {
                // (pass)
            }
        }
        if (!reg) {
            // Fallback to the flag regex (case sensitive)
            reg = RegExp(this.getFlagRegex(), "");
        }
       
        var final_str =
            "" +
            text.replace(reg, function(str) {
                return '<b><span style="color:red">' + str + "</span></b>";
            });

        // speriamo basti..
        return DOMPurify.sanitize(final_str);
    }
}

export default withStyles(styles)(FlowDetail);
