import React, { Component } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
  BackHandler,
  Easing,
  Image,
  DeviceEventEmitter,
} from "react-native";
import { Picker } from "@react-native-community/picker"
import { RNSerialport, definitions, actions } from "react-native-serialport";
import Header from "./header"
class ManualConnection extends Component {
  constructor(props) {
    super(props);
    this.state = {
      servisStarted: false,
      connected: false,
      usbAttached: false,
      output: "",
      outputArray: [],
      baudRate: "9600",
      interface: "-1",
      selectedDevice: null,
      deviceList: [{ name: "Device Not Found", placeholder: true }],
      page: 0,
      selectedNetwork: "",
      networkPassword: "",
      availableNetworks: [],
      rotation: 0,
      returnedDataType: definitions.RETURNED_DATA_TYPES.HEXSTRING
    };

    this.startUsbListener = this.startUsbListener.bind(this);
    this.stopUsbListener = this.stopUsbListener.bind(this);
  }

  backAction = () => {
    if (this.state.page == 0) BackHandler.exitApp()
    else this.setState(prev => ({ page: prev.page - 1 }))
    return true;
  };

  componentDidMount() {

    this.startUsbListener();
  }


  componentWillUnmount() {

    this.stopUsbListener();
  }

  startUsbListener() {


    DeviceEventEmitter.addListener("hardwareBackPress", this.backAction, this)

    DeviceEventEmitter.addListener(
      actions.ON_SERVICE_STARTED,
      this.onServiceStarted,
      this
    );
    DeviceEventEmitter.addListener(
      actions.ON_SERVICE_STOPPED,
      this.onServiceStopped,
      this
    );
    DeviceEventEmitter.addListener(
      actions.ON_DEVICE_ATTACHED,
      this.onDeviceAttached,
      this
    );
    DeviceEventEmitter.addListener(
      actions.ON_DEVICE_DETACHED,
      this.onDeviceDetached,
      this
    );
    DeviceEventEmitter.addListener(actions.ON_ERROR, this.onError, this);
    DeviceEventEmitter.addListener(
      actions.ON_CONNECTED,
      this.onConnected,
      this
    );
    DeviceEventEmitter.addListener(
      actions.ON_DISCONNECTED,
      this.onDisconnected,
      this
    );
    DeviceEventEmitter.addListener(actions.ON_READ_DATA, this.onReadData, this);
    RNSerialport.setReturnedDataType(this.state.returnedDataType);
    RNSerialport.setAutoConnect(false);
    RNSerialport.startUsbService();
  }

  stopUsbListener = async () => {
    DeviceEventEmitter.removeAllListeners();
    const isOpen = await RNSerialport.isOpen();
    if (isOpen) {
      Alert.alert("isOpen", isOpen);
      RNSerialport.disconnect();
    }
    RNSerialport.stopUsbService();
  };

  onServiceStarted(response) {
    this.setState({ servisStarted: true });
    if (response.deviceAttached) {
      this.onDeviceAttached();
    }
  }
  onServiceStopped() {
    this.setState({ servisStarted: false });
    Alert.alert("service stopped");
  }
  onDeviceAttached() {
    this.setState({ usbAttached: true });
    this.fillDeviceList();
  }
  onDeviceDetached() {
    this.setState({ usbAttached: false });
    this.setState({ selectedDevice: null });
    this.setState({
      deviceList: [{ name: "Device Not Found", placeholder: true }]
    });
  }
  onConnected() {
    this.setState({ connected: true });
  }
  onDisconnected() {
    this.setState({ connected: false });
  }
  onReadData(data) {
    if (
      this.state.returnedDataType === definitions.RETURNED_DATA_TYPES.INTARRAY
    ) {
      const payload = RNSerialport.intArrayToUtf16(data.payload);
      this.setState({ output: this.state.output + payload });
    } else if (
      this.state.returnedDataType === definitions.RETURNED_DATA_TYPES.HEXSTRING
    ) {
      const payload = RNSerialport.hexToUtf16(data.payload);
      if (payload.includes("{<wifis")) Alert.alert(payload)
      this.setState({ output: this.state.output + payload });
    }
  }

  onError(error) {
    console.error(error);
  }

  fillDeviceList = async () => {
    try {
      const deviceList = await RNSerialport.getDeviceList();
      if (deviceList.length > 0) {
        this.setState({ deviceList });
        this.setState({ selectedDevice: deviceList[0] })
      } else {
        this.setState({
          deviceList: [{ name: "Device Not Found", placeholder: true }]
        });
      }
    } catch (err) {
      Alert.alert(
        "Error from getDeviceList()",
        err.errorCode + " " + err.errorMessage
      );
    }
  };

  devicePickerItems() {
    return this.state.deviceList.map((device, index) =>
      !device.placeholder ? (
        <Picker.Item key={index} label={device.name} value={device} />
      ) : (
          <Picker.Item key={index} label={device.name} value={null} />
        )
    );
  }

  handleSendButton(msg) {
    if (msg == "list") {
      RNSerialport.writeString("{<wifi::list>}");
    }
    else if (msg == "connect") {
      RNSerialport.writeString(`{<wifi::${this.state.selectedNetwork}||${this.state.networkPassword}>}`);
    }
  }

  handleClearButton() {
    this.setState({ availableNetworks: [] });
  }

  postData = async () => {
    console.log('Requesting config data from Nana Server...');
    const json = await fetch('http://iot.nana.sa/', {
      method: 'post',
      headers: {
        'Content-Type': 'application/json;charset=utf-8'
      },
      body: JSON.stringify({
        mac_address: "AA:AA:AA:AA:AA:AA",
        serial_number: "NAble1",
        is_all: true
      })
    });
    const data = json.json();
    return data["result"]["device"];
  } // postData.then(data => ....)

  checkSupport() {
    if (
      this.state.selectedDevice.name === undefined ||
      this.state.selectedDevice === null
    )
      return;
    RNSerialport.isSupported(this.state.selectedDevice.name)
      .then(status => {
        alert(status ? "Supported" : "Not Supported");
      })
      .catch(error => {
        alert(JSON.stringify(error));
      });
  }

  handleConnectButton = async () => {
    const isOpen = await RNSerialport.isOpen();
    if (isOpen) {
      RNSerialport.disconnect();
    } else {
      if (!this.state.selectedDevice) {
        alert("Please choose device");
        return;
      }
      RNSerialport.setInterface(parseInt(this.state.interface, 10));
      RNSerialport.connectDevice(
        this.state.selectedDevice.name,
        parseInt(this.state.baudRate, 10)
      );
    }
  };

  buttonStyle = status => {
    return status
      ? styles.button
      : Object.assign({}, styles.button, { backgroundColor: "#C0C0C0" });
  };

  readFrom = (message) => {
    const x = message.indexOf("::");
    if (x > 0) // && message.startsWith("{<") && message.endsWith(">}"))
    {
      const key = message.substring(2, x);
      const value = message.substring(x + 2, message.length - 3);
      return { key, value }
    }
    return {}
  }

  render() {
    const spinValue = new Animated.Value(0);
    const spinValue2 = new Animated.Value(0);

    Animated.loop(
      Animated.timing(
        spinValue,
        {
          toValue: 1,
          duration: 12000,
          easing: Easing.linear,
          useNativeDriver: true
        }
      )
    ).start();
    Animated.loop(
      Animated.timing(
        spinValue2,
        {
          toValue: 1,
          duration: 16000,
          easing: Easing.linear,
          useNativeDriver: true
        }
      )
    ).start();

    // Next, interpolate beginning and end values (in this case 0 and 1)
    const spin = spinValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg']
    })
    const spin2 = spinValue2.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg']
    })

    return (
      <View style={styles.view}>
        <Header />
        {this.state.page == 0 &&
          <View style={styles.startButtons}>
            <TouchableOpacity style={styles.startButton} onPress={() => this.setState({ page: 1 })}>
              <Text style={styles.startButtonText}>
                WiFi Settings
            </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.startButton}>
              <Text style={styles.startButtonText}>
                Link with Store
            </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.startButton, { display: "none" }]}>
              <Text style={styles.startButtonText}>
                APN (SIM) Settings
            </Text>
            </TouchableOpacity>
          </View>
        }
        {this.state.page == 1 &&
          <View style={styles.main}>
            <View style={styles.row1}>
              <Text style={styles.deviceName}>No Device!</Text>
              <Image source={require("./box.png")} style={styles.smallBox} />
            </View>
            <View style={styles.row2}>
              <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 20 }}>
                <Image source={require("./smalloval.png")} style={styles.smalloval} />
                <Text style={styles.connected}>connected</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", marginRight: 15 }}>
                <Image source={require("./wifi.png")} style={styles.wifi} />
                <Text style={styles.ssid}>Nana Direct</Text>
              </View>
            </View>
            <View style={styles.row3}>
              <Image source={require("./barcode.png")} style={styles.barcode} />
              <Text style={styles.barcodeDevice}>Symbol Technologies, Inc, 2008</Text>
            </View>
            <TouchableOpacity>
              <Image source={require("./refresh.png")} style={styles.refresh} />
            </TouchableOpacity>
            <ScrollView>
              <TouchableOpacity style={styles.listItem} onPress={() => this.setState({ page: 2 })}>
                <Text style={styles.listItemText}>Symbol Technologies, Inc, 2008</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.listItem}>
                <Text style={styles.listItemText}>Symbol Technologies, Inc, 2008</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.listItem}>
                <Text style={styles.listItemText}>Symbol Technologies, Inc, 2008</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.listItem}>
                <Text style={styles.listItemText}>Symbol Technologies, Inc, 2008</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.listItem}>
                <Text style={styles.listItemText}>Symbol Technologies, Inc, 2008</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.listItem}>
                <Text style={styles.listItemText}>QQQ Technologies, Inc, 2008</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.listItem}>
                <Text style={styles.listItemText}>RRR Technologies, Inc, 2008</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.listItem}>
                <Text style={styles.listItemText}>SSS Technologies, Inc, 2008</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        }
        {this.state.page == 2 &&
          <View style={styles.main}>
            <View style={styles.row1}>
              <Text style={styles.deviceName}>No Device!</Text>
              <Image source={require("./box.png")} style={styles.smallBox} />
            </View>
            <View style={styles.row2}>
              <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 20 }}>
                <Image source={require("./smalloval.png")} style={styles.smalloval} />
                <Text style={styles.connected}>connected</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", marginRight: 15 }}>
                <Image source={require("./wifi.png")} style={styles.wifi} />
                <Text style={styles.ssid}>Nana Direct</Text>
              </View>
            </View>
            <View style={styles.row3}>
              <Image source={require("./barcode.png")} style={styles.barcode} />
              <Text style={styles.barcodeDevice}>Symbol Technologies, Inc, 2008</Text>
            </View>
            <View style={styles.network}>
              <Text style={styles.networkTitle}>Nana Direct</Text>
              <TextInput placeholder={"Password"} style={styles.password} />
              <View style={styles.networkButtons}>
                <TouchableOpacity style={styles.networkConnect}>
                  <Text style={styles.networkButtonTitle}>Connect</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.networkSave}>
                  <Text style={styles.networkButtonTitle}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        }
      </View>
    );
  }
}

const styles = StyleSheet.create({
  view: {
    flex: 1,
    justifyContent: "space-between",
    flexDirection: "column",
    alignItems: "center",
    backgroundColor: "white",
  },
  startButtons: {
    width: 370 - 22,
    height: 400,
    marginTop: 330,
    marginBottom: 15,
    justifyContent: "space-evenly"
  },
  startButton: {
    width: "100%",
    backgroundColor: "#66C200",
    borderColor: "#66C200",
    borderRadius: 8,
    height: 60,
    justifyContent: "center",
    alignItems: "flex-start"

  },
  startButtonText: {
    fontSize: 20,
    fontWeight: "bold",
    marginLeft: 35,
    color: "white",
    borderRadius: 8,
  },
  main: {
    width: '90%',
    height: 500,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    shadowColor: "#B6B6B6",
    elevation: 16,
    marginBottom: 30,
  },
  row1: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  row2: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  deviceName: {
    fontSize: 30,
    marginLeft: 20,
    marginTop: 10,
  },
  smallBox: {
    width: 65,
    height: 57,
    marginRight: 15,
    marginTop: 10
  },
  smalloval: {
    width: 40,
    height: 40,
    borderColor: "black",
  },
  connected: {
    fontSize: 15,
    marginLeft: -3
  },
  ssid: {
    fontSize: 15,
  },
  wifi: {
    width: 28,
    height: 28,
    marginBottom: 7
  },
  row3: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5
  },
  barcode: {
    width: 22,
    height: 22,
    marginLeft: 20,
    marginRight: 10
  },
  refresh: {
    width: 22,
    height: 22,
    marginLeft: 20,
    marginRight: 10,
    alignSelf: "flex-end",
    marginBottom: 10
  },
  barcodeDevice: {
    fontSize: 12
  },
  row4: {
    borderWidth: 1,
    width: '90%',
    height: 220,
    alignSelf: "center",
    borderRadius: 8,
    justifyContent: "flex-start",
    borderColor: '#BEBEBE'
  },
  listItem: {
    borderBottomWidth: 0.5,
    padding: 15
  },
  listItemText: {
    fontSize: 17,
    color: '#818181',
    marginLeft: 10,
  },

  network: {
    borderWidth: 1,
    width: '90%',
    borderColor: '#818181',
    height: '60%',
    alignSelf: "center",
    marginTop: 15,
    borderWidth: 0.5,
    borderRadius: 8,
    padding: 30
  },
  networkTitle: {
    fontSize: 22,
    color: '#818181',
  },
  password: {
    borderWidth: 0.3,
    width: '100%',
    padding: 10,
    borderColor: "#818181",
    borderRadius: 8,
    marginTop: 20,
    fontSize: 18
  },
  networkButtons: {
    flexDirection: "row",
    marginTop: 20,
    width: '100%',
    justifyContent: "space-between"
  },
  networkButtonTitle: {
    color: "white",
    fontSize: 19,
    fontWeight: "bold"
  },
  networkConnect: {
    width: '40%',
    height: "60%",
    borderRadius: 8,
    backgroundColor: "#66C200",
    borderColor: "#66C200",
    justifyContent: "center",
    alignItems: "center"
  },
  networkSave: {
    width: '40%',
    height: "60%",
    borderRadius: 8,
    backgroundColor: "#C5C5C5",
    borderColor: "#C5C5C5",
    justifyContent: "center",
    alignItems: "center"
  }
});

export default ManualConnection;