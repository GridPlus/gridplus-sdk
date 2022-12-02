---
id: "index"
title: "Introduction"
slug: "/"
sidebar_label: "Basic Functionality"
sidebar_position: 0
custom_edit_url: null
---

# GridPlus SDK

The [GridPlus SDK](https://github.com/GridPlus/gridplus-sdk) allows any
application to establish a connection and interact with a GridPlus Lattice
device.

This SDK is designed to facilitate communication with a user's [Lattice1 hardware wallet](https://gridplus.io/lattice). Once paired to a given Lattice, an instance of this SDK is used to make encrypted requests for things like getting addresses/public keys and making signatures.

The Lattice1 is an internet connected device which listens for requests and fills them in firmware. Web requests originate from this SDK and responses are returned asynchronously. Some requests require user authorization and may time out if the user does not approve them.
