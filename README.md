![image](https://user-images.githubusercontent.com/7378490/156425132-232af539-63d9-4dc5-8a6c-63c7bda20125.png)

# GridPlus Lattice1 SDK

- **For help with this SDK, see the [GridPlus SDK Documentation](https://gridplus.github.io/gridplus-sdk)**
- **For help with your Lattice1 hardware, see the [Lattice1 Documentation](https://docs.gridplus.io)**

This SDK is designed to facilitate communication with a user's [Lattice1 hardware wallet](https://gridplus.io/lattice). Once paired to a given Lattice, an instance of this SDK is used to make encrypted requests for things like getting addresses/public keys and making signatures.

The Lattice1 is an internet connected device which listens for requests and fills them in firmware. Web requests originate from this SDK and responses are returned asynchronously. Some requests require user authorization and may time out if the user does not approve them.
